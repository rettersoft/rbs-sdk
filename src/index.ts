import {Subject, ObservableInput, Observable, from, zip, combineLatest} from 'rxjs';
import {tap, concatMap, materialize, finalize, filter, share, withLatestFrom} from 'rxjs/operators';
import axios from 'axios'
import jwt from 'jsonwebtoken'
import api from './api'
import jwtDecode from "jwt-decode";
import {createResponse, parseActionEvent, ActionEvent, RESPONSE_TYPE} from './helpers'

export {ActionEvent, createResponse, parseActionEvent, RESPONSE_TYPE};

interface RbsJwtPayload {
    serviceId?: string
    projectId?: string
    clientId?: string
    iat?: number
    exp?: number
}

interface RBSTokenData {
    accessToken: string
    refreshToken: string
    isServiceToken: boolean
}

interface AuthWithCustomTokenResult {
    success?: string
    message?: string
    uid?: string
    tokenData?: RBSTokenData
}

type AuthWithCustomTokenCallBack = (resp: any) => any;
type SuccessCallBack = (resp: any) => any;
type ErrorCallBack = (e: any) => any;

interface RBSAction {
    action?: string
    data?: any
    onSuccess?: SuccessCallBack
    onError?: ErrorCallBack
}

interface RBSClientConfig {
    projectId: string
    secretKey?: string
    developerId?: string
    serviceId?: string
}

const RBS_TOKENS_KEY = "RBS_TOKENS_KEY"


export default class RBS {

    private static instance: RBS | null = null;

    private commandQueue = new Subject<RBSAction>();

    private customAuthQueue = new Subject<RBSAction>();

    clientConfig: RBSClientConfig

    // Used in node env
    private latestTokenData?: RBSTokenData

    isNode(): boolean {
        return typeof window === 'undefined'
    }

    constructor(config: RBSClientConfig) {

        this.clientConfig = config

        let incomingAction = this.commandQueue.asObservable()

        let getTokenPipe = incomingAction.pipe(
            concatMap((e, i): ObservableInput<any> => {
                return this.getTokenAsObservable()
            }),
            tap(tokenData => {
                this.setTokenData(tokenData)
            })
        )

        let actionResult = zip(incomingAction, getTokenPipe).pipe(
            concatMap(([action, tokenData]) => {
                let endpoint = tokenData.isServiceToken ? '/service/action' : '/user/action'
                return api.post(endpoint, action.data, {
                    action: action.action,
                    auth: tokenData.accessToken
                }).pipe(materialize())
            }),
            share()
        )

        let actionResultSuccess = actionResult.pipe(
            filter((r) => r.hasValue && r.kind === "N")
        )

        let actionResultFail = actionResult.pipe(
            filter((r) => {
                return r.hasValue === false && r.kind === "E"
            })
        )

        actionResultSuccess
            .pipe(
                tap(e => {
                    // console.log("DEBUG SUCCESS", e)
                }),
                withLatestFrom(incomingAction, (result, action) => ({
                    action, result
                }))
            )
            .subscribe(({action, result}) => {
                if (action.onSuccess) {
                    action.onSuccess(result.value)
                }
            })


        actionResultFail
            .pipe(
                tap(e => {
                    // console.log("DEBUG FAIL", e)
                }),
                withLatestFrom(incomingAction, (result, action) => ({
                    action, result
                }))
            )


            .subscribe(({action, result}) => {
                if (action.onError) {
                    action.onError(result.error)
                }
            })


        // Custom auth

        let customAuthAction = this.customAuthQueue.asObservable()

        let authCustomTokenResult = customAuthAction.pipe(
            concatMap((action) => {
                return api.get<RBSTokenData>('/public/auth', {
                    customToken: action.data
                })
            }),
            tap(tokenData => {
                if (tokenData)
                    this.setTokenData(tokenData)
            })
        )

        zip(customAuthAction, authCustomTokenResult).subscribe(([action, result]) => {
            if (action.onSuccess) {
                action.onSuccess(result)
            }
        })
    }

    getTokenAsObservable = (): Observable<RBSTokenData | void> => {

        if (this.clientConfig.secretKey && this.clientConfig.serviceId) {
            let token = jwt.sign({
                projectId: this.clientConfig.projectId,
                identity: `${this.clientConfig.developerId}.${this.clientConfig.serviceId}`,
            }, this.clientConfig.secretKey!, {
                expiresIn: "2 days"
            })

            return from([{
                accessToken: token,
                refreshToken: '',
                isServiceToken: true
            }])
        }

        let now = this.getSafeNow()

        let storedTokenData: RBSTokenData | undefined
        if (this.isNode()) {
            // Node environment
            storedTokenData = this.latestTokenData
        } else {
            // Browser environment
            let item = localStorage.getItem(RBS_TOKENS_KEY)
            if (item) {
                storedTokenData = JSON.parse(item)
            }

        }

        if (storedTokenData) {

            const accessTokenExpiresAt = jwtDecode<RbsJwtPayload>(storedTokenData.accessToken).exp || 0
            const refreshTokenExpiresAt = jwtDecode<RbsJwtPayload>(storedTokenData.refreshToken).exp || 0

            // If token doesn't need refreshing return it.
            if (refreshTokenExpiresAt > now && accessTokenExpiresAt > now) {
                // Just return same token
                return from([storedTokenData])
            }

            // If token needs refreshing, refresh it.
            if (refreshTokenExpiresAt > now && accessTokenExpiresAt < now) {
                // Refresh token
                return api.get<RBSTokenData>('/public/auth-refresh', {
                    refreshToken: storedTokenData.refreshToken
                })
            }
        }

        // Get anonym token
        return api.get<RBSTokenData>('/public/anonymous-auth', {
            projectId: this.clientConfig.projectId,
            developerId: this.clientConfig.developerId,
            serviceId: this.clientConfig.serviceId
        })
    }


    getSafeNow = (): number => {
        return Math.round((new Date()).getTime() / 1000)
    }

    setTokenData = (tokenData: RBSTokenData) => {
        if (this.isNode()) {
            // Node environment
            this.latestTokenData = tokenData
        } else {
            // Browser environment
            localStorage.setItem(RBS_TOKENS_KEY, JSON.stringify(tokenData))
        }
    }

    getStoredTokenData = (): RBSTokenData | undefined => {

        if (this.isNode()) {
            // Node environment
            return this.latestTokenData
        } else {
            // Browser environment
            const storedTokenData = localStorage.getItem(RBS_TOKENS_KEY)
            if (storedTokenData) {
                return JSON.parse(storedTokenData)
            } else {
                return undefined
            }
        }
    }

    // PUBLIC METHODS

    public send = (action: RBSAction): Promise<any> => {
        console.log("send called with", action)
        return new Promise((resolve, reject) => {
            if (!action.onSuccess && !action.onError) {
                action.onSuccess = resolve
                action.onError = reject
            }
            this.commandQueue.next(action)
        })
    }

    public authenticateWithCustomToken = (token: string, onSuccess: SuccessCallBack, onError: ErrorCallBack) => {

        this.customAuthQueue.next({
            action: 'customauth', // this string is not used here.
            data: token,
            onSuccess: (resp: any) => {
                if (onSuccess) onSuccess(resp)
            },
            onError: (e: any) => {
                if (onError) onError(e)
            }
        })

    }

    public signOut = () => {
        if (this.isNode()) {
            // Node environment
            this.latestTokenData = undefined
        } else {
            // Browser environment
            localStorage.removeItem(RBS_TOKENS_KEY)
        }
    }

}