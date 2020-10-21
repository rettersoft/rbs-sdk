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

        this.saveToLocalStorage(BrowserRbsTokenKeys.RbsClientAccessToken + rbsClientSessionId, accessToken)
        this.saveToLocalStorage(BrowserRbsTokenKeys.RbsClientRefreshToken + rbsClientSessionId, refreshToken)
        this.saveToLocalStorage(BrowserRbsTokenKeys.RbsClientCustomToken + rbsClientSessionId, customToken)
        this.saveToLocalStorage(RbsLocalValueKeys.RbsClientSessionId, rbsClientSessionId)
    }

    fetchRbsTokens(): LocalSavedRbsTokens | undefined {
        const rbsClientSessionId = localStorage.getItem(RbsLocalValueKeys.RbsClientSessionId)
        if (!rbsClientSessionId) return undefined

        return {
            RbsClientAccessToken: this.getFromLocalStorage<RbsJwtToken>(BrowserRbsTokenKeys.RbsClientAccessToken + rbsClientSessionId) || "",
            RbsClientCustomToken: this.getFromLocalStorage<RbsJwtToken>(BrowserRbsTokenKeys.RbsClientCustomToken + rbsClientSessionId) || "",
            RbsClientRefreshToken: this.getFromLocalStorage<RbsJwtToken>(BrowserRbsTokenKeys.RbsClientRefreshToken + rbsClientSessionId) || "",
        }
    }

    deleteRbsTokens(): void {
        const rbsClientSessionId = localStorage.getItem(RbsLocalValueKeys.RbsClientSessionId)
        if (!rbsClientSessionId) return undefined
        this.deleteFromLocalStorage(BrowserRbsTokenKeys.RbsClientAccessToken + rbsClientSessionId)
        this.deleteFromLocalStorage(BrowserRbsTokenKeys.RbsClientCustomToken + rbsClientSessionId)
        this.deleteFromLocalStorage(BrowserRbsTokenKeys.RbsClientRefreshToken + rbsClientSessionId)
    }

    deleteFromLocalStorage(key: string){
        localStorage.removeItem(key)
    }

    saveToLocalStorage(key: string, value: any){
        localStorage.setItem(key, value)
    }

    getFromLocalStorage<T>(key: string): T | null{
        return <T | null>localStorage.getItem(key)
    }


}