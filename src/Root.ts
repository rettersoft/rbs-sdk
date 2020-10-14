import {IEndpoint, ServiceType} from "./Services/Endpoints";
import {Http} from "./Services/Http";
import {Config} from "./Config";

export interface AuthInstance {
    apiKey?: string
    adminAccessToken?: string;
    clientAccessToken?: string;
}


export class Root<T> {

    protected readonly http: Http<T>
    protected readonly config: Config<T>

    constructor(http: Http<T>, config: Config<T>) {
        this.http = http
        this.config = config
    }


    serviceFactory<S extends IEndpoint>(service: ServiceType<T, S>): S {
        return new service<T>(this.http, this.config)
    }
}