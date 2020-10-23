import {RbsServiceResponse} from "../../Responses/RbsServiceResponse";
import {IEndpointAdmin, IEndpointClient, IEndpointServer} from "../Endpoints";
import {SessionStateCallbackFunction} from "../../Config";
import {IUserModel} from "../../Models/UserModel";

export namespace MainServiceTypes {


    export type RbsJwtToken = string

    export interface GenerateCustomTokenResponse {
        customToken: RbsJwtToken
    }

    export interface ClientAuthenticateResponse {
        accessToken: RbsJwtToken;
        refreshToken: RbsJwtToken
    }

    export interface RbsTokenPayload {
        projectId: string;
        userId: string;
        iat: number;
        exp: number;
    }

    export interface IClient extends IEndpointClient {
        clientAuthenticate(customToken: RbsJwtToken): Promise<RbsServiceResponse<ClientAuthenticateResponse>>

        clientRefreshToken(refreshToken: RbsJwtToken): Promise<RbsServiceResponse<ClientAuthenticateResponse>>

        setAdminAccessToken(adminAccessToken: RbsJwtToken): void

        setClientAccessToken(clientAccessToken: MainServiceTypes.RbsJwtToken): void

        onSessionStateChanged(callback: SessionStateCallbackFunction): void

        getUser(): Promise<IUserModel>
    }

    export interface IServer extends IEndpointServer {
        generateCustomToken(userId: string): Promise<RbsServiceResponse<GenerateCustomTokenResponse>>
    }

    export interface IAdmin extends IEndpointAdmin {

    }
}

export interface IMainService extends MainServiceTypes.IClient, MainServiceTypes.IAdmin, MainServiceTypes.IServer {

}