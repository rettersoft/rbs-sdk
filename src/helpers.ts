import { fdatasync } from "fs";
import jwtDecode from "jwt-decode";
import { RbsJwtPayload } from "src";

export interface ActionEvent {
    action: string
    actionType: string
    projectId: string
    identity: string
    userId: string
    serviceId: string
    actionPayload: any
}

export const headers: any = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Method': '*',
    'Access-Control-Allow-Credentials': true,
}

export enum RESPONSE_TYPE {
    SUCCESS,
    NO_CONTENT,
    METHOD_NOT_ALLOWED,
    BAD_REQUEST,
    AUTH_FAILED,
    PERMISSION_DENIED,
    NOT_FOUND,
    INTERNAL_SERVER_ERROR
}

const getStatus = (responseType: RESPONSE_TYPE): number => {
    switch (responseType) {
        case RESPONSE_TYPE.SUCCESS: return 200
        case RESPONSE_TYPE.NO_CONTENT: return 204
        case RESPONSE_TYPE.BAD_REQUEST: return 400
        case RESPONSE_TYPE.AUTH_FAILED: return 401
        case RESPONSE_TYPE.PERMISSION_DENIED: return 403
        case RESPONSE_TYPE.NOT_FOUND: return 404
        case RESPONSE_TYPE.METHOD_NOT_ALLOWED: return 405
        case RESPONSE_TYPE.INTERNAL_SERVER_ERROR: return 500
    }
}

export interface RbsServiceResponse {
    responseType: RESPONSE_TYPE
    errorCode?: string
    message?: any
    data?: any
    errors?: string[]
}

export const createResponse = (response: RbsServiceResponse): any => {

    //message: response.message ? response.message : JSON.stringify(response.responseType),

    return {
        statusCode: getStatus(response.responseType),
        headers: {
            ...headers,
            ['x-rbs-errorcode']: response.errorCode
        },
        body: JSON.stringify({
            errors: response.errors,
            data: response.data
        })
    }
}

export const parseActionEvent = (event: any, serviceSecret:string): ActionEvent => {
    const { body } = event

    const data: RbsJwtPayload = jwtDecode<RbsJwtPayload>(serviceSecret)

    let action = event.headers["X-Rbs-Action"] || event.headers["x-rbs-action"]
    let actionType = event.headers["X-Rbs-ActionType"] || event.headers["x-rbs-actiontype"]
    let projectId = event.headers["X-Rbs-ProjectId"] || event.headers["x-rbs-projectid"]
    let identity = event.headers["X-Rbs-Identity"] || event.headers["x-rbs-identity"]
    let userId = event.headers["X-Rbs-UserId"] || event.headers["x-rbs-userid"]
    let serviceId = event.headers["X-Rbs-ServiceId"] || event.headers["x-rbs-serviceid"]
    
    if(data.projectId !== projectId) throw new Error('Auth failed. Invalid JWT Token')

    let isBase64Encoded = false 
    if(event['isBase64Encoded']) {
        isBase64Encoded = Boolean(event['isBase64Encoded'])
    }
    
    let bodyStr:string = "{}"
    if (body && body.length) {
        if (isBase64Encoded) {
            bodyStr = Buffer.from(body, 'base64').toString('utf-8')
        } else {
            bodyStr = body
        }
    }
    
    let actionPayload = JSON.parse(bodyStr)

    return {
        action,
        actionType,
        actionPayload,
        identity,
        projectId,
        serviceId,
        userId,
    }
}

export interface ValidationError {
    target?: Object; // Object that was validated.
    property?: string; // Object's property that haven't pass validation.
    value?: any; // Value that haven't pass a validation.
    constraints?: { // Constraints that failed validation with error messages.
        [type: string]: string;
    };
    children?: ValidationError[]; // Contains all nested validation errors of the property
}

export const parseClassValidatorErrors = (errors: Array<ValidationError>): Array<string> => {
    let root: ValidationError = {
        target: {},
        property: '',
        value: '',
        children: errors
    }

    return parseClassValidatorErrorObject('root', root)
}

const parseClassValidatorErrorObject = (path: string, validationError: ValidationError): Array<string> => {
    let errStrings: string[] = []

    if (validationError.constraints) {
        let keys = Object.keys(validationError.constraints)
        for (let k of keys) {
            errStrings.push(path + '.' + String(validationError.constraints[k]))
        }
    }
    path = path + (validationError.property ? '.' + validationError.property : '')
    if (validationError.children && validationError.children.length > 0) {
        for (let c of validationError.children) {
            errStrings = [...errStrings, ...parseClassValidatorErrorObject(path, c)]
        }
    }
    return errStrings
}
