import {Endpoint, EndpointAdmin, EndpointClient, EndpointServer} from "./Endpoints";
import axios, {AxiosRequestConfig, AxiosResponse, Method} from "axios";
import {Config} from "../Config";
import {Service} from "./Service";
import {RbsServiceResponse} from "../Responses/RbsServiceResponse";
import {RbsGlobals} from "../Globals";
import {Browser} from "../Workers/Browser";
import {MainService} from "./MainService/MainService";


export enum ErrorCodes {
    SERVICE_ERROR = "SERVICE_ERROR",
    UNHANDLED_ERROR = "UNHANDLED_ERROR"
}

export class Http<T> {

    private readonly serviceType: Endpoint<T>;
    private readonly config: Config<T>
    private readonly globals: RbsGlobals;
    private readonly browser: Browser;
    private readonly mainService: MainService<T>

    constructor(type: Endpoint<T>, config: Config<T>) {
        this.serviceType = type
        this.config = config;
        this.globals = new RbsGlobals();
        this.browser = new Browser();
        this.mainService = new MainService<T>(this, config)
        if (this.config.enableLogs) {
            console.log('CONFIG', this.config)
            axios.interceptors.request.use(request => {
                try {
                    console.log('request', JSON.stringify(request, null, 4))
                } catch (e) {
                    console.log('request', request)
                }
                return request
            })
            axios.interceptors.response.use(response => {
                try {
                    console.log('response', JSON.stringify(response, null, 4))
                } catch (e) {
                    console.log('response', response)
                }
                return response
            })
        }
    }


    /**
     *
     * @param service
     * @param method
     * @param methodPath Do Not starts with '/'
     * @param data
     * @param autoTokenRefresh
     */
    public async callService<R>(service: Service<T>, method: Method, methodPath: string, data?: { body?: object | string, params?: object }, autoTokenRefresh = true): Promise<RbsServiceResponse<R>> {
        const url = [this.config.schema + this.config.domain, service.basePath, methodPath].join('/')
        if (data && data.params) data.params = JSON.parse(JSON.stringify(data.params))
        const axiosConfig: AxiosRequestConfig = {
            url,
            data: data ? data.body : undefined,
            params: data ? data.params : undefined,
            headers: {
                "Content-Type": "application/json"
            },
            method
        }
        switch (this.serviceType) {
            case EndpointServer:
                if (!this.config.auth.apiKey) throw new Error('Api Key is required')
                axiosConfig.params = axiosConfig.params ? {...axiosConfig.params, auth: this.config.auth.apiKey} :
                    {auth: this.config.auth.apiKey}
                break
            case EndpointClient:
                if(autoTokenRefresh) await this.refreshClientAccessTokenIsNotValid()
                axiosConfig.params = axiosConfig.params ? {
                        ...axiosConfig.params,
                        auth: this.config.auth.clientAccessToken
                    } :
                    {auth: this.config.auth.clientAccessToken}
                break
            case EndpointAdmin:
                if (!this.config.auth.adminAccessToken) throw new Error('Admin access token is required')
                axiosConfig.headers = axiosConfig.headers ? {
                        ...axiosConfig.headers,
                        Authorization: this.config.auth.adminAccessToken
                    } :
                    {Authorization: this.config.auth.adminAccessToken}
                break
            default:
                throw new Error('Unexpected service type!')
        }
        try {
            const response = await axios(axiosConfig)
            return this.createResponse<R>(response)
        } catch (e) {
            if (this.config.enableLogs) {
                try {
                    console.error(JSON.stringify(e, null, 4))
                } catch (e) {
                    console.error(e)
                }
            }
            return this.createResponse<R>(e.response)
        }
    }

    /**
     * This function supports only Browser
     * @private
     */
    private async refreshClientAccessTokenIsNotValid() {
        if (this.browser.inBrowser) {
            const local = this.browser.fetchRbsTokens()
            if (local && this.globals.tokenIsExpired(local.RbsClientAccessToken) && !this.globals.tokenIsExpired(local.RbsClientRefreshToken)) {
                const response = await this.mainService.clientRefreshToken(local.RbsClientRefreshToken)
                if (response.result) {
                    this.browser.saveRbsTokens(response.result.refreshToken, response.result.accessToken, local.RbsClientCustomToken)
                    this.config.auth.clientAccessToken = response.result.accessToken
                }
            }
        }
    }

    private createResponse<T>(axiosResponse: AxiosResponse): RbsServiceResponse<T> {
        if (axiosResponse && axiosResponse.status) {
            if (axiosResponse.status >= 200 && axiosResponse.status < 400)
                return new RbsServiceResponse<T>({
                    statusCode: axiosResponse.status,
                    result: axiosResponse.data,
                })
            else
                return new RbsServiceResponse<T>({
                    statusCode: axiosResponse.status,
                    error: {
                        code: ErrorCodes.SERVICE_ERROR,
                        error: axiosResponse.data,
                        message: axiosResponse.data && axiosResponse.data.message ? axiosResponse.data.message : ""
                    }
                })
        } else {
            return new RbsServiceResponse<T>({
                statusCode: 500,
                error: {
                    code: ErrorCodes.UNHANDLED_ERROR,
                    error: 'internal error occurred',
                    message: axiosResponse.data && axiosResponse.data.message ? axiosResponse.data.message : ""
                }
            })
        }

    }
}