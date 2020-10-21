import {Service} from "../Service";
import {IMainService, MainServiceTypes} from "./IMainService";
import {Http} from "../Http";
import {Config} from "../../Config";
import {RbsServiceResponse} from "../../Responses/RbsServiceResponse";
import {Browser} from "../../Workers/Browser";


export class MainService<T> extends Service<T> implements IMainService {
    readonly basePath: string;
    private readonly browser: Browser;

    constructor(http: Http<T>, config: Config<T>) {
        super(http, config);
        this.basePath = "MainService"
        this.browser = new Browser();
    }


    async clientAuthenticate(customToken: MainServiceTypes.RbsJwtToken): Promise<RbsServiceResponse<MainServiceTypes.ClientAuthenticateResponse>> {

        const response = await this.http.callService<MainServiceTypes.ClientAuthenticateResponse>(this, "post", "public/authenticate", {
            body: {
                customToken
            }
        },false)

        if (response.result) {
            if(this.browser.inBrowser)
                this.browser.saveRbsTokens(response.result.refreshToken, response.result.accessToken, customToken)

            this.config.auth.clientAccessToken = response.result.accessToken

        }

        return response
    }

    async clientRefreshToken(refreshToken: MainServiceTypes.RbsJwtToken): Promise<RbsServiceResponse<MainServiceTypes.ClientAuthenticateResponse>> {
        const response = await this.http.callService<MainServiceTypes.ClientAuthenticateResponse>(this, "post", "public/refresh-token", {
            body: {
                refreshToken
            }
        },false)
        if(response.result){
            if(this.browser.inBrowser){
                const data = this.browser.fetchRbsTokens()
                if(data){
                    this.browser.saveRbsTokens(response.result.refreshToken, response.result.accessToken, data.RbsClientCustomToken)
                }
            }
            this.config.auth.clientAccessToken = response.result.accessToken
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

}