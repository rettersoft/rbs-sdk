import {IUserModel} from "./Models/UserModel";
import {Config} from "./Config";
import {Browser} from "./Workers/Browser";
import {RbsGlobals} from "./Globals";

export enum SessionStates {
    AUTHENTICATED = "AUTHENTICATED",
    AUTH_FAILED = "AUTH_FAILED",
    AUTH_REFRESHED = "AUTH_REFRESHED",
    AUTH_REFRESH_FAILED = "AUTH_REFRESH_FAILED",
    LOGOUT = "LOGOUT"
}


export class Triggers<T> {
    private readonly config: Config<T>;
    private readonly browser: Browser;
    private readonly globals: RbsGlobals;

    constructor(config: Config<T>) {
        this.config = config;
        this.browser = new Browser();
        this.globals = new RbsGlobals();
    }


    sessionStateChangeTrigger(state: SessionStates) {
        if (this.browser.inBrowser) {
            for (const cb of this.config.sessionStateCallbacks) {
                const localRbsTokens = this.browser.fetchRbsTokens()
                if (localRbsTokens && localRbsTokens.RbsClientAccessToken && !this.globals.tokenIsExpired(localRbsTokens.RbsClientAccessToken)) {
                    const payload = this.globals.getRbsTokenPayload(localRbsTokens.RbsClientAccessToken)
                    const user: IUserModel = {
                        userId: payload.userId
                    }
                    cb(state, user)
                } else {
                    cb(state, undefined)
                }
            }
        }
    }


}