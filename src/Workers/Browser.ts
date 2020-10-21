import {MainServiceTypes} from "../Services/MainService/IMainService";
import RbsJwtToken = MainServiceTypes.RbsJwtToken;
import crypt from "crypto"


enum BrowserRbsTokenKeys {
    RbsClientRefreshToken = "RbsClientRefreshToken",
    RbsClientAccessToken = "RbsClientAccessToken",
    RbsClientCustomToken = "RbsClientCustomToken"
}

enum RbsLocalValueKeys {
    RbsClientSessionId = "RbsClientSessionId"
}

export interface LocalSavedRbsTokens {
    RbsClientRefreshToken: string;
    RbsClientAccessToken: string;
    RbsClientCustomToken: string;
}

export class Browser {
    public readonly inBrowser: boolean;

    constructor() {
        this.inBrowser = typeof window !== "undefined"
    }


    saveRbsTokens(refreshToken: RbsJwtToken, accessToken: RbsJwtToken, customToken: RbsJwtToken): void {
        const rbsClientSessionId: string = crypt.createHash('md5').update(customToken).digest('hex')

        localStorage.setItem(BrowserRbsTokenKeys.RbsClientAccessToken + rbsClientSessionId, accessToken)
        localStorage.setItem(BrowserRbsTokenKeys.RbsClientRefreshToken + rbsClientSessionId, refreshToken)
        localStorage.setItem(BrowserRbsTokenKeys.RbsClientCustomToken + rbsClientSessionId, customToken)
        localStorage.setItem(RbsLocalValueKeys.RbsClientSessionId, rbsClientSessionId)
    }

    fetchRbsTokens(): LocalSavedRbsTokens | undefined {
        const rbsClientSessionId = localStorage.getItem(RbsLocalValueKeys.RbsClientSessionId)
        if (!rbsClientSessionId) return undefined

        return {
            RbsClientAccessToken: localStorage.getItem(BrowserRbsTokenKeys.RbsClientAccessToken + rbsClientSessionId) || "",
            RbsClientCustomToken: localStorage.getItem(BrowserRbsTokenKeys.RbsClientCustomToken + rbsClientSessionId) || "",
            RbsClientRefreshToken: localStorage.getItem(BrowserRbsTokenKeys.RbsClientRefreshToken + rbsClientSessionId) || "",
        }
    }


}