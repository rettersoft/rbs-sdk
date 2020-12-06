import {Subject, ObservableInput, Observable, from, zip, combineLatest, defer} from 'rxjs';
import {tap, concatMap, materialize, finalize, filter, share, withLatestFrom, map, mergeMap} from 'rxjs/operators';
import axios, {AxiosRequestConfig} from 'axios'
import jwt from 'jsonwebtoken'
import api from './api'
import jwtDecode from "jwt-decode";
import {createResponse, parseActionEvent, ActionEvent, RESPONSE_TYPE} from './helpers'
import initializeAxios from "./axiosSetup";


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

export const axiosRequestConfiguration: AxiosRequestConfig = {
    baseURL: 'https://core-test.rettermobile.com',
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },

};

const axiosInstance = initializeAxios(axiosRequestConfiguration);

interface RBSAction {
    action?: string
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

        let actionResult = incomingAction.pipe(
            concatMap(async action => {
                let actionWrapper = {
                    action
                }
                return await this.getActionWithTokenData(actionWrapper)
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

                        actionWrapper.tokenData = await api.getP<RBSTokenData>('/public/auth-refresh', {
                            refreshToken: storedTokenData.refreshToken
                        })
                    }
                } else {
                    // Get anonym token

                    actionWrapper.tokenData = await api.getP<RBSTokenData>('/public/anonymous-auth', {
                        projectId: this.clientConfig.projectId,
                        developerId: this.clientConfig.developerId,
                        serviceId: this.clientConfig.serviceId
                    })
                }


            }

            resolve(actionWrapper)

        })


    }

    post = (url: string, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            axiosInstance.post(url, actionWrapper.action?.data, {
                params: {
                    auth: actionWrapper.tokenData?.accessToken,
                    action: actionWrapper.action?.action
                }
            }).then((resp) => {
                actionWrapper.response = resp.data
                resolve(actionWrapper)
            }).catch((err) => {
                actionWrapper.responseError = err
                reject(actionWrapper)
            })
        })
    }

    get = (url: string, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            axiosInstance.get(url, {
                params: {
                    auth: actionWrapper.tokenData?.accessToken,
                    action: actionWrapper.action?.action
                }
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