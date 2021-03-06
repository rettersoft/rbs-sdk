import { Subject, ObservableInput, Observable, from, zip, combineLatest, defer, ReplaySubject } from 'rxjs';
import { tap, concatMap, materialize, finalize, filter, share, withLatestFrom, map, mergeMap } from 'rxjs/operators';
import { AxiosInstance, AxiosRequestConfig } from 'axios'
import jwt from 'jsonwebtoken'
import jwtDecode from "jwt-decode";
import { createResponse, parseActionEvent, ActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError } from './helpers'
import initializeAxios from "./axiosSetup";


export { ActionEvent, createResponse, parseActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError };

export interface ServiceResponse {
    errorCode: string
    serviceId: string
    status: number
    errors: string[]
    response: any
    durationInMilliseconds: number
    executionDurationInMilliseconds: number
    headers: { [key: string]: string }
}

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

export interface RBSTokenData {
    accessToken: string
    refreshToken: string
    isServiceToken: boolean
}

type SuccessCallBack = (resp: any) => any;
type ErrorCallBack = (e: any) => any;

interface RBSAction {
    action?: string
    targetServiceId?: string
    relatedUserId?: string
    data?: any
    headers?: { [key: string]: string }

    onSuccess?: SuccessCallBack
    onError?: ErrorCallBack
}

interface RBSActionWrapper {
    action?: RBSAction
    tokenData?: RBSTokenData
    response?: any
    responseError?: Error
}



interface RbsRegionConfiguration {
    regionId?: RbsRegion,
    getUrl: string,
    url: string
}

enum RbsRegion {
    euWest1
}

const RbsRegions: Array<RbsRegionConfiguration> = [{
    regionId: RbsRegion.euWest1,
    getUrl: 'https://core.rtbs.io',
    url: 'https://core-internal.rtbs.io'
}]

interface RBSClientConfig {
    projectId: string
    secretKey?: string
    developerId?: string
    serviceId?: string
    region?: RbsRegion
    regionConfiguration?: RbsRegionConfiguration
}

export enum RBSAuthStatus {
    SIGNED_IN = "SIGNED_IN",
    SIGNED_IN_ANONYM = "SIGNED_IN_ANONYM",
    SIGNED_OUT = "SIGNED_OUT",
    AUTH_FAILED = "AUTH_FAILED"
}

export interface RBSAuthChangedEvent {
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

    private getServiceEndpoint = (actionWrapper: RBSActionWrapper): string => {
        let endpoint = actionWrapper.tokenData!.isServiceToken ? '/service/action' : '/user/action'
        const action = actionWrapper.action!.action!
        const actionType = action.split('.')[2]
        endpoint = `${endpoint}/${this.clientConfig.projectId}/${action}`
        return endpoint
    }

    private getBaseUrl = (action: string): string => {

        let region:RbsRegionConfiguration|undefined = undefined

        if(this.clientConfig.regionConfiguration) {
            region = this.clientConfig.regionConfiguration
        } else {
            region = RbsRegions.find(r => r.regionId === this.clientConfig.region)
            if (!region) {
                region = RbsRegions.find(r => r.regionId === RbsRegion.euWest1)
            }
        }

        if(!region) throw new Error('Invalid rbs region')

        if (action.includes('.get.')) {
            return region.getUrl
        } else {
            return region.url
        }
    }

    private axiosInstance: AxiosInstance

    constructor(config: RBSClientConfig) {

        const axiosRequestConfiguration: AxiosRequestConfig = {
            responseType: 'json',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        this.axiosInstance = initializeAxios(axiosRequestConfiguration);

        this.clientConfig = config

        if (!this.clientConfig.region) this.clientConfig.region = RbsRegion.euWest1

        let incomingAction = this.commandQueue.asObservable()

        let actionResult = incomingAction.pipe(
            concatMap(async action => {
                let actionWrapper: RBSActionWrapper = {
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
                const action = ev.action!.action!
                const actionType = action.split('.')[2]
                endpoint = `${endpoint}/${this.clientConfig.projectId}/${action}`

                endpoint = this.getBaseUrl(action) + this.getServiceEndpoint(ev)

                if (actionType === 'get') {
                    // console.log('running get request to', endpoint)
                    return defer(() => this.get(endpoint, ev)).pipe(materialize())
                } else {
                    // console.log('running post request to', endpoint)
                    return defer(() => this.post(endpoint, ev)).pipe(materialize())
                }

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

                return defer(() => this.getPlain('/public/auth', { customToken: action.data }, actionWrapper)).pipe(materialize())
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

    _getStoredTokenData = (): RBSTokenData | undefined => {
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
        return storedTokenData
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

                let storedTokenData: RBSTokenData | undefined = this._getStoredTokenData()

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

                        actionWrapper.tokenData = await this.getP<RBSTokenData>(this.getBaseUrl('') + '/public/auth-refresh', {
                            refreshToken: storedTokenData.refreshToken
                        })
                    }
                } else {
                    // Get anonym token

                    const url = this.getBaseUrl('') + '/public/anonymous-auth'
                    // console.log('url', url)
                    // console.log('params', {
                    //     projectId: this.clientConfig.projectId,
                    //     developerId: this.clientConfig.developerId,
                    //     serviceId: this.clientConfig.serviceId
                    // })
                    actionWrapper.tokenData = await this.getP<RBSTokenData>(url, {
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
            let params: any = {
                auth: actionWrapper.tokenData?.accessToken,
            }
            if (actionWrapper.action?.targetServiceId) {
                params.targetServiceId = actionWrapper.action?.targetServiceId
            }
            if (actionWrapper.action?.relatedUserId) {
                params.relatedUserId = actionWrapper.action?.relatedUserId
            }
            this
                .axiosInstance
                .post(url, actionWrapper.action?.data, {
                    params,
                    headers: actionWrapper.action?.headers
                })
                .then((resp) => {
                    actionWrapper.response = resp.data
                    resolve(actionWrapper)
                }).catch((err) => {
                    actionWrapper.responseError = err
                    reject(actionWrapper)
                })
        })
    }

    getParams = (actionWrapper: RBSActionWrapper): any => {
        let params: any = {
            auth: actionWrapper.tokenData?.accessToken,
        }
        if (actionWrapper.action?.data) {
            const data = actionWrapper.action?.data ? actionWrapper.action?.data : {}
            params.data = Buffer.from(JSON.stringify(data)).toString('base64')
        }
        if (actionWrapper.action?.targetServiceId) {
            params.targetServiceId = actionWrapper.action?.targetServiceId
        }
        if (actionWrapper.action?.relatedUserId) {
            params.relatedUserId = actionWrapper.action?.relatedUserId
        }
        return params
    }

    get = (url: string, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            let params = this.getParams(actionWrapper)
            // console.log(params)
            this.axiosInstance.get(url, {
                params,
                headers: {
                    ['Content-Type']: 'text/plain',
                    ...actionWrapper.action?.headers
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

    getPlain = (url: string, params: any, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
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

    public generateGetActionUrl = async (action: RBSAction): Promise<string> => {
        let actionWrapper: RBSActionWrapper = {
            action
        }
        const actionWithToken = await this.getActionWithTokenData(actionWrapper)
        let params = this.getParams(actionWithToken)
        let url = this.getBaseUrl(action.action!) + this.getServiceEndpoint(actionWithToken) + '?'

        for (let k of Object.keys(params)) {
            url = `${url}${k}=${params[k]}&`
        }

        return url
    }

    public send = (action: RBSAction): Promise<Array<ServiceResponse>> => {

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