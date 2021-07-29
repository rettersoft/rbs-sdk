import { Subject, ObservableInput, Observable, from, zip, combineLatest, defer, ReplaySubject, timer } from 'rxjs';
import { tap, concatMap, materialize, finalize, filter, share, withLatestFrom, map, mergeMap, debounce, distinctUntilChanged } from 'rxjs/operators';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import jwt from 'jsonwebtoken'
import jwtDecode from "jwt-decode";
import { createResponse, parseActionEvent, ActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError } from './helpers'
import initializeAxios from "./axiosSetup";
import base64Helpers from './base64'
import log, { LogLevelDesc } from 'loglevel'
import { WebsocketBuilder, Websocket as WebSocket1, ConstantBackoff } from 'websocket-ts';


export { ActionEvent, createResponse, parseActionEvent, RESPONSE_TYPE, parseClassValidatorErrors, ValidationError };

enum LogLevel {
    VERBOSE = 1,
    DEBUG,
    ERROR
}
interface LogMessage {
    level: LogLevel
    message: string
}

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
    accessTokenExpiresAt: number
    refreshTokenExpiresAt: number
    isServiceToken: boolean
}

type SuccessCallBack = (resp: any) => any;
type ErrorCallBack = (e: any) => any;

interface RBSAction {
    action?: string
    targetServiceId?: string
    relatedUserId?: string
    data?: any
    culture?: string
    headers?: { [key: string]: string }

    generateGetUrl?: boolean

    onSuccess?: SuccessCallBack
    onError?: ErrorCallBack
}

interface RBSActionWrapper {
    action?: RBSAction
    tokenData?: RBSTokenData
    response?: any
    responseError?: Error
    url?: string
}



export interface RbsRegionConfiguration {
    regionId?: RbsRegion,
    getUrl: string,
    url: string,
    socketUrl: string
}

export enum RbsRegion {
    euWest1, euWest1Beta
}

const RbsRegions: Array<RbsRegionConfiguration> = [{
    regionId: RbsRegion.euWest1,
    getUrl: 'https://core.rtbs.io',
    url: 'https://core-internal.rtbs.io',
    socketUrl: 'wss://socket.rtbs.io'
}, {
    regionId: RbsRegion.euWest1Beta,
    getUrl: 'https://core-test.rettermobile.com',
    url: 'https://core-internal-beta.rtbs.io',
    socketUrl: 'wss://socket-test.rtbs.io'
}]

export enum RbsClientPlatformType {
    IOS = "IOS",
    ANDROID = "ANDROID",
    SERVICE = "SERVICE",
    WEB = "WEB",
    OTHER = "OTHER"
}

interface RBSClientConfig {
    projectId: string
    secretKey?: string
    developerId?: string
    serviceId?: string
    region?: RbsRegion
    regionConfiguration?: RbsRegionConfiguration
    anonymTokenTTL?: number
    logLevel?: LogLevelDesc
    agentType?: RbsClientPlatformType
    agentName?: string
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

export enum SocketConnectionStatus {
    CONNECTED = "CONNECTED",
    DISCONNECTED = "DISCONNECTED",
}

export enum RBSSocketEventType {
    CONNECTED = "CONNECTED",
    DISCONNECTED = "DISCONNECTED",
    MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
    ERROR = "ERROR",
    RETRY = "RETRY"
}

export interface RBSSocketEvent {
    eventType: RBSSocketEventType
    data?: any | undefined
    error?: any | undefined
}

export interface RBSSocket {
    socket?: WebSocket1 | null
    userId?: string | null
}


export default class RBS {

    private static instance: RBS | null = null

    private commandQueue = new Subject<RBSAction>()
    private customAuthQueue = new Subject<RBSAction>()

    private _socketEvents = new Subject<RBSSocketEvent>()

    private clientConfig: RBSClientConfig | null = null
    private axiosInstance: AxiosInstance | null = null

    // Used in node env
    private latestTokenData?: RBSTokenData

    private initialized: boolean = false

    private _socket: RBSSocket | null = null

    isNode(): boolean {
        return typeof window === 'undefined'
    }

    private authStatusSubject = new ReplaySubject<RBSAuthChangedEvent>(1)

    private socketConnectionStatusSubject = new ReplaySubject<SocketConnectionStatus>(1)

    public get socketConnectionStatus(): Observable<SocketConnectionStatus> {
        return this.socketConnectionStatusSubject.asObservable()
    }



    public get authStatus(): Observable<RBSAuthChangedEvent> {
        return this.authStatusSubject
            .asObservable()
            .pipe(distinctUntilChanged((a, b) => a.authStatus === b.authStatus &&
                a.identity === b.identity &&
                a.uid === b.uid))
        // .pipe(debounce(() => timer(100)))

    }

    public get socketEvents(): Observable<RBSSocketEvent> {
        return this._socketEvents.asObservable()
    }

    private getServiceEndpoint = (actionWrapper: RBSActionWrapper): string => {
        let endpoint = actionWrapper.tokenData!.isServiceToken ? '/service/action' : '/user/action'
        const action = actionWrapper.action!.action!
        const actionType = action.split('.')[2]
        endpoint = `${endpoint}/${this.clientConfig!.projectId}/${action}`
        return endpoint
    }

    private getCurrentRegionConfiguration = (): RbsRegionConfiguration | undefined => {
        return RbsRegions.find(r => r.regionId === this.clientConfig!.region)
    }

    private getBaseUrl = (action: string): string => {

        let region: RbsRegionConfiguration | undefined = undefined

        if (this.clientConfig!.regionConfiguration) {
            region = this.clientConfig!.regionConfiguration
        } else {
            region = RbsRegions.find(r => r.regionId === this.clientConfig!.region)
            if (!region) {
                region = RbsRegions.find(r => r.regionId === RbsRegion.euWest1)
            }
        }

        if (!region) throw new Error('Invalid rbs region')

        if (action.includes('.get.')) {
            return region.getUrl
        } else {
            return region.url
        }
    }

    private constructor() { }

    public static getInstance(config: RBSClientConfig | null = null, newInstance: boolean = true): RBS {
        if (!RBS.instance || newInstance) {
            RBS.instance = new RBS()
            if (config) {
                RBS.instance.init(config)
            }
        }
        return RBS.instance
    }

    public static dispose() {
        RBS.instance = null
    }

    init(config: RBSClientConfig) {

        if (this.initialized) throw new Error('RBS SDK already initialized.')
        this.initialized = true

        const axiosRequestConfiguration: AxiosRequestConfig = {
            responseType: 'json',
            headers: {
                'Content-Type': 'application/json',
            },

            timeout: 30000
        };

        this.axiosInstance = initializeAxios(axiosRequestConfiguration);

        if (config.logLevel)
            log.setLevel(config.logLevel)
        else
            log.setLevel("ERROR")

        this.clientConfig! = config

        if (!this.clientConfig!.region) this.clientConfig!.region = RbsRegion.euWest1

        let incomingAction = this.commandQueue.asObservable()

        let actionResult = incomingAction.pipe(
            concatMap(async action => {
                let actionWrapper: RBSActionWrapper = {
                    action
                }
                return await this.getActionWithTokenData(actionWrapper)
            }),

            filter(actionWrapper => actionWrapper.tokenData != null),
            tap(actionWrapper => {
                this.setTokenData(actionWrapper.tokenData!)
            }),
            tap(actionWrapper => {
                this.fireAuthStatus(actionWrapper.tokenData)
            }),
            tap(async actionWrapper => {
                // Connect socket here.
                await this.connectSocket()
            }),
            mergeMap((ev) => {

                let endpoint = ev.tokenData!.isServiceToken ? '/service/action' : '/user/action'
                const action = ev.action!.action!
                const actionType = action.split('.')[2]
                endpoint = `${endpoint}/${this.clientConfig!.projectId}/${action}`

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
                if (e.value.action.generateGetUrl) {
                    e.value.action.onSuccess(e.value.url)
                } else {
                    e.value.action.onSuccess(e.value?.response)
                }
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

                // console.log('HEYHAT')

                let actionWrapper: RBSActionWrapper = {
                    action
                }

                // const url = this.getBaseUrl(action.action!) + '/public/auth'
                // console.log('url', url)

                return defer(() => this.getPlain(this.getBaseUrl(action.action!) + '/public/auth', { customToken: action.data }, actionWrapper)).pipe(materialize())
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
                    isServiceToken: false,
                    accessTokenExpiresAt: 0,
                    refreshTokenExpiresAt: 0
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

        this.authStatus.subscribe((e) => {
            console.log("AUTH STATUS LISTENER", e)

            // this.connectSocket()
        })

        this._socketEvents.subscribe((e) => {
            switch(e.eventType)  {
                case RBSSocketEventType.DISCONNECTED: {
                    this.commandQueue.next({
                        action: 'rbs.core.request.PING'
                    })
                    break
                }
            }
        })
    }

    connectSocket = () : Promise<boolean> => {

        return new Promise((resolve, reject) => {

            if(this.isNode()) {
                resolve(true)
                return
            }

            // Check if there is a connected socket

            let connectionRequired = false
            let userId: string | undefined = undefined

            const storedTokenData = this.getStoredTokenData()

            if(!storedTokenData) {
                resolve(false)
                return
            }

            if (this._socket && this._socket.socket && storedTokenData) {
                userId = jwtDecode<RbsJwtPayload>(storedTokenData.accessToken).userId
                if (userId !== this._socket.userId) {
                    connectionRequired = true
                    this._socket.socket.close()
                }
            } else {
                connectionRequired = true
            }


            if (connectionRequired) {
                let wsUrl = this.getCurrentRegionConfiguration()?.socketUrl
                console.log('wsUrl', wsUrl)

                console.log('this.getStoredTokenData()?.accessToken', storedTokenData.accessToken)
                if (wsUrl && storedTokenData.accessToken) {
                    console.log('OPENING SOCKET')
                    const socket = new WebsocketBuilder(wsUrl + "?auth=" + this.getStoredTokenData()?.accessToken)
                        .onOpen((i, ev) => {
                            console.log("SOCKET opened")
                            this._socketEvents.next({
                                eventType: RBSSocketEventType.CONNECTED
                            })
                            resolve(true)
                        })
                        .onClose((i, ev) => {
                            console.log("SOCKET closed")
                            this._socketEvents.next({
                                eventType: RBSSocketEventType.DISCONNECTED
                            })
                        })
                        .onError((i, ev) => {
                            console.log("SOCKET error")
                            this._socketEvents.next({
                                eventType: RBSSocketEventType.ERROR,
                                error: ev
                            })
                        })
                        .onMessage((i, ev) => {
                            console.log("SOCKET message")
                            this._socketEvents.next({
                                eventType: RBSSocketEventType.MESSAGE_RECEIVED,
                                data: ev.data
                            })
                        })
                        .onRetry((i, ev) => {
                            console.log("SOCKET retry")
                            this._socketEvents.next({
                                eventType: RBSSocketEventType.RETRY,
                                error: ev
                            })
                        })
                        // .withBackoff(new ConstantBackoff(1000)) // 1000ms = 1s
                        .build()

                    this._socket = {
                        socket,
                        userId
                    }
                }
            }


        })


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
        const event = this.getAuthChangedEvent(tokenData)
        log.info('RBSSDK LOG: fireAuthStatus event:', event)
        this.authStatusSubject.next(event)
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


    logMessage = (logMessage: LogMessage) => {

    }

    getActionWithTokenData = (actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {

        return new Promise(async (resolve, reject) => {

            log.info('RBSSDK LOG: getActionWithTokenData started')

            if (this.clientConfig!.secretKey && this.clientConfig!.serviceId) {

                log.info('RBSSDK LOG: secretKey and serviceId found')

                let token = jwt.sign({
                    projectId: this.clientConfig!.projectId,
                    identity: `${this.clientConfig!.developerId}.${this.clientConfig!.serviceId}`,
                }, this.clientConfig!.secretKey!, {
                    expiresIn: "2 days"
                })

                actionWrapper.tokenData = {
                    accessToken: token,
                    refreshToken: '',
                    isServiceToken: true,
                    accessTokenExpiresAt: 0,
                    refreshTokenExpiresAt: 0
                }

            } else {

                log.info('RBSSDK LOG: secretKey and serviceId not found')

                let now = this.getSafeNow()

                log.info('RBSSDK LOG: now:', now)

                let storedTokenData: RBSTokenData | undefined = this._getStoredTokenData()

                log.info('RBSSDK LOG: storedTokenData:', storedTokenData)

                if (storedTokenData) {

                    log.info('RBSSDK LOG: storedTokenData is defined')

                    const accessTokenExpiresAt = jwtDecode<RbsJwtPayload>(storedTokenData.accessToken).exp || 0
                    const refreshTokenExpiresAt = jwtDecode<RbsJwtPayload>(storedTokenData.refreshToken).exp || 0

                    // If token doesn't need refreshing return it.
                    if (refreshTokenExpiresAt > now && accessTokenExpiresAt > now) {

                        log.info('RBSSDK LOG: returning same token')
                        // Just return same token
                        actionWrapper.tokenData = storedTokenData

                    }

                    // If token needs refreshing, refresh it.
                    if (refreshTokenExpiresAt > now && accessTokenExpiresAt <= now) {  // now + 280 -> only wait 20 seconds for debugging
                        // Refresh token

                        log.info('RBSSDK LOG: token refresh needed')
                        // console.log('refreshing token')
                        actionWrapper.tokenData = await this.getP<RBSTokenData>(this.getBaseUrl('') + '/public/auth-refresh', {
                            refreshToken: storedTokenData.refreshToken
                        })

                        log.info('RBSSDK LOG: refreshed tokenData:', actionWrapper.tokenData)

                    }
                } else {

                    log.info('RBSSDK LOG: getting anonym token')

                    // Get anonym token
                    const url = this.getBaseUrl('') + '/public/anonymous-auth'

                    let params: any = {
                        projectId: this.clientConfig!.projectId,
                        developerId: this.clientConfig!.developerId,
                        serviceId: this.clientConfig!.serviceId,
                    }
                    if (this.clientConfig!.anonymTokenTTL) {
                        params.ttlInSeconds = this.clientConfig!.anonymTokenTTL
                    }

                    actionWrapper.tokenData = await this.getP<RBSTokenData>(url, params)

                    log.info('RBSSDK LOG: fetched anonym token:', actionWrapper.tokenData)
                }

            }

            log.info('RBSSDK LOG: resolving with actionWrapper:', actionWrapper)

            resolve(actionWrapper)
        })

    }

    getP = async <T>(url: string, queryParams?: object): Promise<T> => {
        return (await this.axiosInstance!.get<T>(url, { params: queryParams })).data
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
            if (actionWrapper.action?.headers) {
                params.headers = base64Helpers.urlEncode(JSON.stringify(actionWrapper.action?.headers))
                console.log('params.headers', params.headers)
            }
            if (actionWrapper.action?.culture) {
                params.culture = actionWrapper.action.culture
            }

            this
                .axiosInstance!
                .post(url, actionWrapper.action?.data, {
                    params
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
            params.data = base64Helpers.urlEncode(JSON.stringify(data))
        }
        if (actionWrapper.action?.targetServiceId) {
            params.targetServiceId = actionWrapper.action?.targetServiceId
        }
        if (actionWrapper.action?.relatedUserId) {
            params.relatedUserId = actionWrapper.action?.relatedUserId
        }
        if (actionWrapper.action?.headers) {
            params.headers = base64Helpers.urlEncode(JSON.stringify(actionWrapper.action?.headers))
        }
        if (actionWrapper.action?.culture) {
            params.culture = actionWrapper.action.culture
        }

        return params
    }

    get = (url: string, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            let params = this.getParams(actionWrapper)

            if (actionWrapper.action?.generateGetUrl) {
                // Don't get from server but just return get url
                let url = this.getBaseUrl(actionWrapper.action.action!) + this.getServiceEndpoint(actionWrapper) + '?'

                for (let k of Object.keys(params)) {
                    url = `${url}${k}=${params[k]}&`
                }

                actionWrapper.url = url
                resolve(actionWrapper)

            } else {
                this.axiosInstance!.get(url, {
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
            }

        })
    }

    getPlain = (url: string, params: any, actionWrapper: RBSActionWrapper): Promise<RBSActionWrapper> => {
        return new Promise((resolve, reject) => {
            this.axiosInstance!.get(url, {
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
        return Math.round((new Date()).getTime() / 1000) + 30 // Plus 30 seconds, just in case.
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



    // PUBLIC METHODS

    public getStoredTokenData = (): RBSTokenData | undefined => {

        if (this.isNode()) {
            // Node environment
            return this.latestTokenData
        } else {
            // Browser environment
            const storedTokenData = localStorage.getItem(RBS_TOKENS_KEY)
            if (storedTokenData) {
                const data: RBSTokenData = JSON.parse(storedTokenData)
                const accessTokenExpiresAt = jwtDecode<RbsJwtPayload>(data.accessToken).exp || 0
                const refreshTokenExpiresAt = jwtDecode<RbsJwtPayload>(data.refreshToken).exp || 0
                data.accessTokenExpiresAt = accessTokenExpiresAt
                data.refreshTokenExpiresAt = refreshTokenExpiresAt
                return data
            } else {
                return undefined
            }
        }
    }

    public getUser = (): RbsJwtPayload | null => {
        let tokenData = this.getStoredTokenData()
        if (!tokenData) return null
        return jwtDecode<RbsJwtPayload>(tokenData.accessToken)
    }

    public generatePublicGetActionUrl = (action: RBSAction): string => {

        let actionWrapper: RBSActionWrapper = {
            action,
            tokenData: {
                isServiceToken: false,
                accessToken: '',
                refreshToken: '',
                accessTokenExpiresAt: 0,
                refreshTokenExpiresAt: 0
            }
        }

        let params = this.getParams(actionWrapper)

        // Don't get from server but just return get url
        let url = this.getBaseUrl(actionWrapper.action!.action!) + this.getServiceEndpoint(actionWrapper) + '?'

        for (let k of Object.keys(params)) {
            url = `${url}${k}=${params[k]}&`
        }

        return url
    }

    public generateGetActionUrl = (action: RBSAction): Promise<string> => {

        if (!this.initialized) throw new Error('RBS SDK is not initialized')

        if (!action.culture) action.culture = 'en-US'

        return new Promise((resolve, reject) => {
            if (!action.onSuccess && !action.onError) {
                action.onSuccess = resolve
                action.onError = reject
            }
            action.generateGetUrl = true
            this.commandQueue.next(action)
        })
    }

    public send = (action: RBSAction): Promise<Array<ServiceResponse>> => {

        if (!this.initialized) throw new Error('RBS SDK is not initialized')

        if (!action.culture) action.culture = 'en-US'

        return new Promise((resolve, reject) => {
            if (!action.onSuccess && !action.onError) {
                action.onSuccess = resolve
                action.onError = reject
            }
            this.commandQueue.next(action)
        })
    }

    public authenticateWithCustomToken = (token: string): Promise<RBSAuthChangedEvent> => {

        if (!this.initialized) throw new Error('RBS SDK is not initialized')

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
        if (!this.initialized) throw new Error('RBS SDK is not initialized')

        if (this.isNode()) {
            // Node environment
            this.latestTokenData = undefined
        } else {
            // Browser environment
            localStorage.removeItem(RBS_TOKENS_KEY)
            
            if(this._socket && this._socket.socket) {
                this._socket.socket.close()
            }
            
        }

        this.fireAuthStatus(this.getStoredTokenData())
    }


}