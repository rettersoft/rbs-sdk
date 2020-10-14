import {Http} from "./Http";
import {Config} from "../Config";


export abstract class Service<T> {

    abstract readonly basePath: string;

    protected readonly http: Http<T>
    protected readonly config: Config<T>

    protected isBrowser: boolean;

    protected constructor(http: Http<T>, config: Config<T>) {
        this.http = http
        this.config = config
        this.isBrowser = typeof window !== "undefined"
    }


}