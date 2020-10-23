import {Config, IConfig} from "./Config";
import {EndpointAdmin, EndpointClient, EndpointServer} from "./Services/Endpoints";
import {Root} from "./Root";
import {Http} from "./Services/Http";
import {ProductService} from "./Services/ProductService/ProductService";
import {ProductServiceTypes} from "./Services/ProductService/IProductService";
import {MainServiceTypes} from "./Services/MainService/IMainService";
import {MainService} from "./Services/MainService/MainService";
import {RbsGlobals} from "./Globals";


interface IRBSClientInstance {
    product: ProductServiceTypes.IClient
    main: MainServiceTypes.IClient
}

interface IRBSServerInstance {
    product: ProductServiceTypes.IServer
    main: MainServiceTypes.IServer
}

interface IRBSAdminInstance {
    product: ProductServiceTypes.IAdmin
    main: MainServiceTypes.IAdmin
}

export default class RBS extends RbsGlobals {
    private readonly config: IConfig

    private readonly clientConfig: Config<EndpointClient>
    private readonly clientRoot: Root<EndpointClient>
    private readonly clientHttp: Http<EndpointClient>


    private readonly serverConfig: Config<EndpointServer>
    private readonly serverRoot: Root<EndpointServer>
    private readonly serverHttp: Http<EndpointServer>

    private readonly adminConfig: Config<EndpointAdmin>
    private readonly adminRoot: Root<EndpointAdmin>
    private readonly adminHttp: Http<EndpointAdmin>

    private static instance: RBS | null = null;

    constructor(config?: IConfig) {
        super();

        this.config = config || {}

        this.clientConfig = new Config<EndpointClient>(EndpointClient, this.config)
        this.serverConfig = new Config<EndpointServer>(EndpointServer, this.config)
        this.adminConfig = new Config<EndpointAdmin>(EndpointAdmin, this.config)

        this.clientHttp = new Http<EndpointClient>(EndpointClient, this.clientConfig)
        this.serverHttp = new Http<EndpointServer>(EndpointServer, this.serverConfig)
        this.adminHttp = new Http<EndpointAdmin>(EndpointAdmin, this.adminConfig)

        this.clientRoot = new Root<EndpointClient>(this.clientHttp, this.clientConfig)
        this.serverRoot = new Root<EndpointServer>(this.serverHttp, this.serverConfig)
        this.adminRoot = new Root<EndpointAdmin>(this.adminHttp, this.adminConfig)

        if(RBS.instance !== null){
            return RBS.instance
        }else{
            RBS.instance = this
        }
    }


    get client() {
        return <IRBSClientInstance>{
            main: this.clientRoot.serviceFactory<MainServiceTypes.IClient>(MainService),
            product: this.clientRoot.serviceFactory<ProductServiceTypes.IClient>(ProductService)
        }
    }

    get server() {
        return <IRBSServerInstance>{
            main: this.serverRoot.serviceFactory<MainServiceTypes.IServer>(MainService),
            product: this.serverRoot.serviceFactory<ProductServiceTypes.IServer>(ProductService)
        }
    }

    get admin() {
        return <IRBSAdminInstance>{
            main: this.adminRoot.serviceFactory<MainServiceTypes.IAdmin>(MainService),
            product: this.adminRoot.serviceFactory<ProductServiceTypes.IAdmin>(ProductService)
        }
    }

}