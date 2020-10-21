import {Endpoint, EndpointAdmin, EndpointClient, EndpointServer} from "./Services/Endpoints";
import {AuthInstance} from "./Root";
import pp = jasmine.pp;
import {Browser} from "./Workers/Browser";
import {MainServiceTypes} from "./Services/MainService/IMainService";
import RbsJwtToken = MainServiceTypes.RbsJwtToken;

export interface IConfig {
    domain?: string;
    schema?: string;
    enableLogs?: boolean;
    auth?: AuthInstance
}

export class Config<T> implements IConfig {

    private readonly _attribute: any;
    private readonly browser: Browser;

    constructor(type: Endpoint<T>, props: IConfig) {
        this.browser = new Browser();
        const defaultConfigs: IConfig = {
            enableLogs: false,
            auth: {},
            domain: "rbsmain.rettermobile.com",
            schema: "https://"
        }
        this._attribute = {...defaultConfigs, ...props}
        switch (type) {
            case EndpointServer:
                this._attribute.domain = this._attribute.domain + '/server'
                break
            case EndpointClient:
                this._attribute.domain = this._attribute.domain + '/client'
                break
            case EndpointAdmin:
                this._attribute.domain = this._attribute.domain + '/admin'
                break
            default:
                throw new Error('Unexpected service type!')
        }
    }

    get domain() {
        return this._attribute.domain
    }

    get schema() {
        return this._attribute.schema
    }

    get merchantId() {
        return this._attribute.merchantId
    }

    get enableLogs() {
        return this._attribute.enableLogs
    }

    get auth() {
        const auth = this._attribute.auth
        if(this.browser.inBrowser){
            const fetchedTokens = this.browser.fetchRbsTokens()
            if(fetchedTokens) auth.clientAccessToken = fetchedTokens.RbsClientAccessToken || "null"
        }
        return auth
    }

    set auth(auth: AuthInstance) {
        this._attribute.auth = auth
    }


}
