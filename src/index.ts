import { Subject, ObservableInput, Observable, from, zip, combineLatest, defer, ReplaySubject } from 'rxjs';
import { tap, concatMap, materialize, finalize, filter, share, withLatestFrom, map, mergeMap } from 'rxjs/operators';
import { AxiosInstance, AxiosRequestConfig } from 'axios'
import jwt from 'jsonwebtoken'
import jwtDecode from "jwt-decode";
import { createResponse, parseActionEvent, ActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError } from './helpers'
import initializeAxios from "./axiosSetup";


export { ActionEvent, createResponse, parseActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError };

export interface RbsJwtPayload {
    serviceId?: string
    projectId?: string
    clientId?: string
    userId?: string
    anonymous?: boolean
    identity?: string
    iat?: number
    exp?: number
}

interface RBSTokenData {
    accessToken: string
    refreshToken: string
    isServiceToken: boolean
}

type SuccessCallBack = (resp: any) => any;
type ErrorCallBack = (e: any) => any;

interface RBSAction {
    action?: string
    targetServiceId?: string
    data?: any

    onSuccess?: SuccessCallBack
    onError?: ErrorCallBack
}

interface RBSActionWrapper {
    action?: RBSAction
    tokenData?: RBSTokenData
    response?: any
    responseError?: Error
}

interface RBSClientConfig {
    projectId: string
    secretKey?: string
    developerId?: string
    serviceId?: string
    rbsUrl?: string
}

enum RBSAuthStatus {
    SIGNED_IN = "SIGNED_IN",
    SIGNED_IN_ANONYM = "SIGNED_IN_ANONYM",
    SIGNED_OUT = "SIGNED_OUT",
    AUTH_FAILED = "AUTH_FAILED"
}

interface RBSAuthChangedEvent {
    authStatus: RBSAuthStatus
    identity?: string
    uid?: string
    message?: string
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

    private authStatusSubject = new ReplaySubject<RBSAuthChangedEvent>(1)

    public get authStatus(): Observable<RBSAuthChangedEvent> {
        return this.authStatusSubject.asObservable()
    }

    private axiosInstance: AxiosInstance

    constructor(config: RBSClientConfig) {

        const axiosRequestConfiguration: AxiosRequestConfig = {
            baseURL: config.rbsUrl ? config.rbsUrl : 'https://core.rtbs.io',
            responseType: 'json',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        this.axiosInstance = initializeAxios(axiosRequestConfiguration);

        this.clientConfig = config

        let incomingAction = this.commandQueue.asObservable()

        let actionResult = incomingAction.pipe(
            concatMap(async action => {
                let actionWrapper = {
                    action
                }
                return await this.getActionWithTokenData(actionWrapper)
            }),
            tap(actionWrapper => {
                this.fireAuthStatus(actionWrapper.tokenData)
            }),
            filter(actionWrapper => actionWrapper.tokenData != null),
            tap(actionWrapper => {
                this.setTokenData(actionWrapper.tokenData!)
            }),
            mergeMap((ev) => {
                let endpoint = ev.tokenData!.isServiceToken ? '/service/action' : '/user/action'
                return defer(() => this.post(endpoint, ev)).pipe(materialize())
            }),
            share()
        )

        actionResult.pipe(
            filter((r) => r.hasValue && r.kind === "N")
        ).subscribe(e => {
            if (e.value?.action?.onSuccess) {
                e.value.action.onSuccess(e.value?.response)
            }
        })

        actionResult.pipe(
            filter((r) => r.hasValue === false && r.kind === "E")
        ).subscribe(e => {
            if (e.error) {
                let actionWrapper: RBSActionWrapper = e.error
                if (actionWrapper.action?.onError) {
                    actionWrapper.action?.onError(actionWrapper.responseError)
                }
            }
        })


        // Custom auth


        let customAuthResult = this.customAuthQueue.pipe(
            concatMap((action) => {

                let actionWrapper: RBSActionWrapper = {
                    action
                }

                return defer(() => this.get('/public/auth', { customToken: action.data }, actionWrapper)).pipe(materialize())
            }),

            share()
        )

        customAuthResult.pipe(
            filter((r) => r.hasValue && r.kind === "N"),
            map(e => {
                let actionWrapper = e.value!
                actionWrapper.tokenData = {
                    accessToken: actionWrapper.response.data.accessToken,
                    refreshToken: actionWrapper.response.data.refreshToken,
                    isServiceToken: false
                }
                return actionWrapper
            }),
            tap(actionWrapper => {
                if (actionWrapper.tokenData) {
                    this.setTokenData(actionWrapper.tokenData)
                }
                this.fireAuthStatus(actionWrapper.tokenData)
            })
        ).subscribe(actionWrapper => {
            let authEvent = this.getAuthChangedEvent(this.getStoredTokenData())
            if (actionWrapper.action!.onSuccess) {
                actionWrapper.action!.onSuccess(authEvent)
            }
        })

        customAuthResult.pipe(
            filter((r) => r.hasValue === false && r.kind === "E")
        ).subscribe(e => {
            if (e.error) {
                let actionWrapper: RBSActionWrapper = e.error
                if (actionWrapper.action?.onError) {
                    actionWrapper.action?.onError({
                        authStatus: RBSAuthStatus.AUTH_FAILED,
                        message: actionWrapper.responseError
                    })
                }
            }
        })

        this.fireAuthStatus(this.getStoredTokenData())
    }


    getAuthChangedEvent = (tokenData: RBSTokenData | undefined): RBSAuthChangedEvent => {
        if (!tokenData) {
            return {
                authStatus: RBSAuthStatus.SIGNED_OUT
            }
        } else {

            const data: RbsJwtPayload = jwtDecode<RbsJwtPayload>(tokenData!.accessToken)

            if (data.anonymous) {
                return {
                    authStatus: RBSAuthStatus.SIGNED_IN_ANONYM,
                    uid: data.userId,
                    identity: data.identity,
                }
            } else {

                return {
                    authStatus: RBSAuthStatus.SIGNED_IN,
                    uid: data.userId,
                    identity: data.identity,
                }
            }
        }
    }

    fireAuthStatus = (tokenData: RBSTokenData | undefined) => {
        this.authStatusSubject.next(this.getAuthChangedEvent(tokenData))
    }



    getActionWithTokenData = (actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {

        return new Promise(async (resolve, reject) => {

            if (this.clientConfig.secretKey && this.clientConfig.serviceId) {

                let token = jwt.sign({
                    projectId: this.clientConfig.projectId,
                    identity: `${this.clientConfig.developerId}.${this.clientConfig.serviceId}`,
                }, this.clientConfig.secretKey!, {
                    expiresIn: "2 days"
                })

                actionWrapper.tokenData = {
                    accessToken: token,
                    refreshToken: '',
                    isServiceToken: true
                }

            } else {
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
                        actionWrapper.tokenData = storedTokenData
                    }

                    // If token needs refreshing, refresh it.
                    if (refreshTokenExpiresAt > now && accessTokenExpiresAt < now) {
                        // Refresh token

                        actionWrapper.tokenData = await this.getP<RBSTokenData>('/public/auth-refresh', {
                            refreshToken: storedTokenData.refreshToken
                        })
                    }
                } else {
                    // Get anonym token

                    actionWrapper.tokenData = await this.getP<RBSTokenData>('/public/anonymous-auth', {
                        projectId: this.clientConfig.projectId,
                        developerId: this.clientConfig.developerId,
                        serviceId: this.clientConfig.serviceId
                    })
                }


            }

            resolve(actionWrapper)

        })


    }

    getP = async <T>(url: string, queryParams?: object): Promise<T> => {
        return (await this.axiosInstance.get<T>(url, { params: queryParams })).data
    }

    post = (url: string, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            let params:any = {
                auth: actionWrapper.tokenData?.accessToken,
                action: actionWrapper.action?.action
            }
            if (actionWrapper.action?.targetServiceId) {
                params.targetServiceId = actionWrapper.action?.targetServiceId
            }
            this
                .axiosInstance
                .post(url, actionWrapper.action?.data, { params })
                .then((resp) => {
                    actionWrapper.response = resp.data
                    resolve(actionWrapper)
                }).catch((err) => {
                    actionWrapper.responseError = err
                    reject(actionWrapper)
                })
        })
    }

    get = (url: string, params: any, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            this.axiosInstance.get(url, {
                params
            }).then((resp) => {
                actionWrapper.response = resp
                resolve(actionWrapper)
            }).catch((err) => {
                actionWrapper.responseError = err
                reject(actionWrapper)
            })
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
        return new Promise((resolve, reject) => {
            if (!action.onSuccess && !action.onError) {
                action.onSuccess = resolve
                action.onError = reject
            }
            this.commandQueue.next(action)
        })
    }

    public authenticateWithCustomToken = (token: string): Promise<RBSAuthChangedEvent> => {

        return new Promise((resolve, reject) => {

            let action = {
                action: 'customauth', // this string is not used here.
                data: token,
                onSuccess: resolve,
                onError: reject
            }

            this.customAuthQueue.next(action)
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

        this.fireAuthStatus(this.getStoredTokenData())
    }

}