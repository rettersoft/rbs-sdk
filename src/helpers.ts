
export interface ActionEvent {
    action:string
    actionType:string
    projectId:string
    identity:string
    userId:string
    serviceId:string
    actionPayload:any
}

export const headers: any = {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Method': '*',
    'Access-Control-Allow-Credentials': true,
}

export enum RESPONSE_TYPE {
    SUCCESS, 
    METHOD_NOT_ALLOWED,
    BAD_REQUEST,
    AUTH_FAILED,
    NOT_FOUND,
    INTERNAL_SERVER_ERROR
}

const getStatus = (responseType:RESPONSE_TYPE) : number => {
    switch(responseType) {
        case RESPONSE_TYPE.SUCCESS: return 200
        case RESPONSE_TYPE.BAD_REQUEST: return 400
        case RESPONSE_TYPE.AUTH_FAILED: return 401
        case RESPONSE_TYPE.NOT_FOUND: return 404
        case RESPONSE_TYPE.METHOD_NOT_ALLOWED: return 405
        case RESPONSE_TYPE.INTERNAL_SERVER_ERROR: return 500
    }
}

export interface RbsServiceResponse {
    responseType:RESPONSE_TYPE
    serviceErrorCode?: number
    message?: any
    data?:any
}

export const createResponse = (response:RbsServiceResponse) : any => {
    return {
        statusCode: getStatus(response.responseType),
        headers,
        body: JSON.stringify({ 
            message: response.message ? JSON.stringify(response.message) : JSON.stringify(response.responseType),
            serviceErrorCode: response.serviceErrorCode ? response.serviceErrorCode : 0,
            data: response.data
        })
    }
}

export const parseActionEvent = (event: any): ActionEvent => {
    const { body } = event

    let action = event.headers["X-Rbs-Action"]
    let actionType = event.headers["X-Rbs-ActionType"]
    let projectId = event.headers["X-Rbs-ProjectId"]
    let identity = event.headers["X-Rbs-Identity"]
    let userId = event.headers["X-Rbs-UserId"]
    let serviceId = event.headers["X-Rbs-ServiceId"]
    let actionPayload = JSON.parse(body ? body : '{}')

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