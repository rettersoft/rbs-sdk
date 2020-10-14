import {ErrorCodes} from "../Services/Http";

export interface IBaseServiceResponseModel<T> {
    statusCode: number;
    result?: T;
    error?:{
        code: ErrorCodes,
        error: any,
        message: string
    }
}


export class RbsServiceResponse<T> implements IBaseServiceResponseModel<T> {

    private readonly _attributes: IBaseServiceResponseModel<T>

    constructor(props: IBaseServiceResponseModel<T>) {
        this._attributes = props
    }

    get error() {
        return this._attributes.error
    }

    get result() {
        return this._attributes.result
    }

    get statusCode() {
        return this._attributes.statusCode
    }

}