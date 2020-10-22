import {
    BulkUpdateItem,
    CategoryTree,
    Filter,
    List,
    Product,
    SearchResponse,
    SingleMerchantProductStock,
    StockOperationResult
} from '../../../../services/ProductService2/src/search/models'
import {RbsServiceResponse} from "../../Responses/RbsServiceResponse";
import {IEndpointAdmin, IEndpointClient, IEndpointServer} from "../Endpoints";

export namespace ProductServiceTypes {

    export namespace Enums {
        export enum SortOrder {
            ASC, DESC
        }
    }
    export namespace Inputs {
        export interface StockOperation {
            productId: string
            stocks: Array<StockOperationStockItem>
        }

        export interface SearchInput {
            searchTerm?: string
            categoryId?: string
            culture?: string
            filters?: Array<Filter>
            aggs?: boolean,
            from?: number,
            size?: number,
            sortAttribute?: string,
            sortOrder?: Enums.SortOrder,
            inStock?: boolean
        }


    }

    interface StockOperationStockItem {
        variant: string
        qty: number
    }


    export interface IClient extends IEndpointClient {

        search(input?: Inputs.SearchInput): Promise<RbsServiceResponse<SearchResponse>>

        getProduct(productId: string, culture: string, merchantId?: string): Promise<RbsServiceResponse<Product>>

        getProductStock(productId: string, merchantId: string, variant: string): Promise<RbsServiceResponse<SingleMerchantProductStock>>

        getMultipleProducts(productIds: Array<string>, culture: string): Promise<RbsServiceResponse<Product>>

        getCategories(culture: string): Promise<RbsServiceResponse<CategoryTree>>

        getListProducts(listId: string, culture: string, inStock: boolean): Promise<RbsServiceResponse<List>>

    }

    export interface IServer extends IEndpointServer, IClient{
        updateMerchantData(items: Array<BulkUpdateItem>): Promise<RbsServiceResponse<boolean>>
        executeStockOperation(operations: Array<Inputs.StockOperation>, decrease: boolean, simulated: boolean):
            Promise<RbsServiceResponse<StockOperationResult>>;
        getProductStockByMerchant(merchantId: string): Promise<RbsServiceResponse<SingleMerchantProductStock[]>>

    }

    export interface IAdmin extends IEndpointAdmin{

    }
}

export interface IProductService extends ProductServiceTypes.IAdmin, ProductServiceTypes.IClient, ProductServiceTypes.IClient {

}