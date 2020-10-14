export interface IEndpoint {
}


export interface IEndpointServer extends IEndpoint {
}

export interface IEndpointClient extends IEndpoint {
}

export interface IEndpointAdmin extends IEndpoint {
}


export class EndpointServer implements IEndpointServer {
}

export class EndpointClient implements IEndpointClient {
}

export class EndpointAdmin implements IEndpointAdmin {
}


export interface Endpoint<T> {
    new(...args: any[]): T;
}

export interface ServiceType<E, S> {
    new<E>(...args: any[]): S;
}