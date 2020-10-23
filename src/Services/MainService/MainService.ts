import {Service} from "../Service";
import {IMainService, MainServiceTypes} from "./IMainService";
import {Http} from "../Http";
import {Config, SessionStateCallbackFunction} from "../../Config";
import {RbsServiceResponse} from "../../Responses/RbsServiceResponse";
import {Browser} from "../../Workers/Browser";
import {RbsGlobals} from "../../Globals";
import {IUserModel} from "../../Models/UserModel";
import {SessionStates} from "../../Triggers";


export class MainService<T> extends Service<T> implements IMainService {
    readonly basePath: string;
    private readonly browser: Browser;
    private readonly globals: RbsGlobals;

    constructor(http: Http<T>, config: Config<T>) {
        super(http, config);
        this.basePath = "MainService"
        this.browser = new Browser();
        this.globals = new RbsGlobals()
    }

    onSessionStateChanged(callback: SessionStateCallbackFunction): void {
        if (this.browser.inBrowser) {
            this.config.sessionStateCallback = callback
        }
    }

    /**
     * @return IUserModel
     * @throws Error
     */
    async getUser(): Promise<IUserModel> {
        const payload = this.getAccessTokenPayloadIfNotExpired()
        if (payload) {
            const user: IUserModel = {
                userId: payload.userId
            }
            return user
        } else {
            throw new Error('User getting error!')
        }
    }


    async clientAuthenticate(customToken: MainServiceTypes.RbsJwtToken): Promise<RbsServiceResponse<MainServiceTypes.ClientAuthenticateResponse>> {

        const response = await this.http.callService<MainServiceTypes.ClientAuthenticateResponse>(this, "post", "public/authenticate", {
            body: {
                customToken
            }
        }, false)

        if (response.result) {
            if (this.browser.inBrowser) {
                const data = this.browser.fetchRbsTokens()
                if (data) this.browser.deleteRbsTokens()
                this.browser.saveRbsTokens(response.result.refreshToken, response.result.accessToken, customToken)
                this.config.triggers.sessionStateChangeTrigger(SessionStates.AUTHENTICATED)
            }

            this.config.auth.clientAccessToken = response.result.accessToken
        } else {
            if (this.browser.inBrowser) {
                this.config.triggers.sessionStateChangeTrigger(SessionStates.AUTH_FAILED)
            }
        }

        return response
    }

    async clientRefreshToken(refreshToken: MainServiceTypes.RbsJwtToken): Promise<RbsServiceResponse<MainServiceTypes.ClientAuthenticateResponse>> {
        const response = await this.http.callService<MainServiceTypes.ClientAuthenticateResponse>(this, "post", "public/refresh-token", {
            body: {
                refreshToken
            }
        }, false)
        if (response.result) {
            if (this.browser.inBrowser) {
                const data = this.browser.fetchRbsTokens()
                if (data) {
                    this.browser.saveRbsTokens(response.result.refreshToken, response.result.accessToken, data.RbsClientCustomToken)
                }
                this.config.triggers.sessionStateChangeTrigger(SessionStates.AUTH_REFRESHED)
            }
            this.config.auth.clientAccessToken = response.result.accessToken
        } else {
            if (this.browser.inBrowser) {
                this.config.triggers.sessionStateChangeTrigger(SessionStates.AUTH_REFRESH_FAILED)
            }
        }
        return response
    }

    async generateCustomToken(userId: string): Promise<RbsServiceResponse<MainServiceTypes.GenerateCustomTokenResponse>> {
        return await this.http.callService<MainServiceTypes.GenerateCustomTokenResponse>(this, "get", "token", {
            params: {
                userId
            }
        })
    }

    setAdminAccessToken(adminAccessToken: MainServiceTypes.RbsJwtToken): void {
        this.config.auth.adminAccessToken = adminAccessToken
    }

    setClientAccessToken(clientAccessToken: MainServiceTypes.RbsJwtToken): void {
        this.config.auth.clientAccessToken = clientAccessToken
    }

    private getAccessTokenPayloadIfNotExpired() {
        if (this.browser.inBrowser) {
            const localRbsTokens = this.browser.fetchRbsTokens()
            if (localRbsTokens && localRbsTokens.RbsClientAccessToken && !this.globals.tokenIsExpired(localRbsTokens.RbsClientAccessToken)) {
                return this.globals.getRbsTokenPayload(localRbsTokens.RbsClientAccessToken)
            }
        } else {
            if (this.config.auth.clientAccessToken && !this.globals.tokenIsExpired(this.config.auth.clientAccessToken)) {
                return this.globals.getRbsTokenPayload(this.config.auth.clientAccessToken)
            }
        }
        throw new Error('Token is invalid!')
    }

}