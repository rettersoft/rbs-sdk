import {MainServiceTypes} from "./Services/MainService/IMainService";
import RbsTokenPayload = MainServiceTypes.RbsTokenPayload;
import RbsJwtToken = MainServiceTypes.RbsJwtToken;


interface IRbsGlobals {
    getRbsTokenPayload(token: MainServiceTypes.RbsJwtToken): MainServiceTypes.RbsTokenPayload
}

export class RbsGlobals implements IRbsGlobals {

    getRbsTokenPayload(token: MainServiceTypes.RbsJwtToken): MainServiceTypes.RbsTokenPayload {
        return <RbsTokenPayload>JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'))
    }

    tokenIsExpired(token: RbsJwtToken): boolean {
        const payload = this.getRbsTokenPayload(token)
        return payload.exp < (Math.round(Date.now() / 1000))

    }

}