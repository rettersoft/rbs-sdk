import {IProductService, ProductServiceTypes} from "./IProductService";
import {RbsServiceResponse} from "../../Responses/RbsServiceResponse";
import {
    BulkUpdateItem,
    CategoryTree,
    List,
    Product,
    SearchResponse,
    SingleMerchantProductStock,
    StockOperationResult
} from "../../../../services/ProductService2/src/search/models";
import { QueryBuilder } from "../../../../services/ProductService2/src/search/queryBuilder"
import {Service} from "../Service";
import {Http} from "../Http";
import {Config} from "../../Config";
import SortOrder = ProductServiceTypes.Enums.SortOrder;


enum ProductServicePaths {
    AGGS_ENDPOINT = "aggs",
    SEARCH_ENDPOINT = "search"
}


export class ProductService<T> extends Service<T> implements IProductService {
    readonly basePath: string;

    constructor(http: Http<T>, config: Config<T>) {
        super(http, config);
        this.basePath = "ProductService2"
    }


    async executeStockOperation(operations: Array<ProductServiceTypes.Inputs.StockOperation>, decrease: boolean, simulated: boolean): Promise<RbsServiceResponse<StockOperationResult>> {
        
        const body = {
            decrease,
            data: operations.map((o) => ({
                merchant: {
                    id: o.merchantId
                },
                productId: o.productId,
                stocks: o.stocks.map(s => ({variantName: s.variant, stockQty: s.qty}))
            }))
        }

        const methodPath = simulated ? 'simulatedStockOperation' : 'insertStockOperation'

        return await this.http.callService<StockOperationResult>(this, "post", methodPath, {body})

    }

    async getCategories(culture: string = "en_US"): Promise<RbsServiceResponse<CategoryTree>> {
        return await this.http.callService<CategoryTree>(this, "get", "getCategories", {
            params: {
                culture
            }
        })
    }

    async getListProducts(listId: string, culture: string = 'en_US', inStock: boolean = false): Promise<RbsServiceResponse<List>> {
        let params:any = {
            culture,
            listId,
        }
        if(inStock !== undefined) {
            params.inStock = inStock
        }
        return await this.http.callService<List>(this, "get", "getList", {
            params
        })
    }

    async getMultipleProducts(productIds: Array<string>, culture: string = 'en_US'): Promise<RbsServiceResponse<Product>> {
        return await this.http.callService<Product>(this, "get", "getMultipleProducts", {
            params: {
                productIds: productIds.join('|'),
                culture
            }
        })
    }

    async getProduct(productId: string, culture: string = 'en_US', merchantId?: string): Promise<RbsServiceResponse<Product>> {
        return await this.http.callService<Product>(this, "get", "getProduct", {
            params: {
                productId,
                culture,
                merchantId
            }
        })
    }

    async getProductStock(productId: string, merchantId: string, variant: string): Promise<RbsServiceResponse<SingleMerchantProductStock>> {
        return await this.http.callService<SingleMerchantProductStock>(this, "get", "getProductStock", {
            params: {
                productId,
                merchantId,
                variant
            }
        })
    }

    async getProductStockByMerchant(merchantId: string): Promise<RbsServiceResponse<SingleMerchantProductStock[]>> {
        return await this.http.callService<SingleMerchantProductStock[]>(this, "get", "getProductStockByMerchant", {
            params: {
                merchantId
            }
        })
    }

    async search(input?: ProductServiceTypes.Inputs.SearchInput): Promise<RbsServiceResponse<SearchResponse>> {
        
        let params: ProductServiceTypes.Inputs.SearchInput = {
            filters: [],
            aggs: false,
            inStock: false,
            categoryId: '',
            culture: 'en_US',
            from: 0,
            size: 20,
            sortAttribute: 'price',
            sortOrder: SortOrder.DESC,
        }
        if (input) {
            params = {...params, ...input}
        }

        if(params.inStock === false) {
            delete params.inStock
        }

        const path = params.aggs ? ProductServicePaths.AGGS_ENDPOINT : ProductServicePaths.SEARCH_ENDPOINT

        const paramsNew = {
            ...params,
            filters: QueryBuilder.filtersToQueryString(params.filters!)
        }

        return await this.http.callService<SearchResponse>(this, "get", path, {
            params: paramsNew
        })
    }

    async updateMerchantData(items: Array<BulkUpdateItem>): Promise<RbsServiceResponse<boolean>> {
        return await this.http.callService<boolean>(this, "post", "updateMerchantData", {
            body: items
        })
    }


}