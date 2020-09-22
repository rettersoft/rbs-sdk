import { QueryBuilder } from '../../services/product_service/src/search/queryBuilder'
import { CategoryTree, Filter, Product, ProductAttribute, SearchResponse, ServiceResponse, List, BulkUpdateItem } from '../../services/product_service/src/search/models'

import axios from 'axios'

const SERVICE_URL = 'https://rbstest.rettermobile.com'
const AGGS_ENDPOINT = '/product_service/aggs'
const SEARCH_ENDPOINT = '/product_service/search'

interface RBSConfiguration {
    projectId: string
    serviceUrl?: string
}

interface SearchInput {
    userId?: string
    searchTerm?: string
    categoryId: string
    culture: string
    filters?: Array<Filter>
    aggs: boolean,
    from?: number,
    size?: number
}




/**
 * RBSClient
 */
export class RBSClient {

    config: RBSConfiguration

    constructor(config: RBSConfiguration) {
        this.config = config
        if (!this.config.serviceUrl) this.config.serviceUrl = SERVICE_URL
    }

    public search = (input: SearchInput = { filters: [], aggs: false, categoryId: '', culture: 'en_US', from: 0, size: 20 }): Promise<SearchResponse> => {
        if (!input.userId) throw new Error('UserId is missing')

        return new Promise<SearchResponse>((resolve, reject) => {
            const qsVal = QueryBuilder.filtersToQueryString(input.filters!)
            const endpoint = input.aggs ? AGGS_ENDPOINT : SEARCH_ENDPOINT

            let url = this.config.serviceUrl! + endpoint + '?filters=' + qsVal
                + '&categoryId=' + input.categoryId
                + '&culture=' + input.culture
                + '&from=' + input.from
                + '&size=' + input.size
                + '&userId=' + input.userId
            if (input.searchTerm) {
                url += '&searchTerm=' + input.searchTerm
            }
            axios.get(url, {
                headers: {
                },
            }).then(response => {
                resolve(response.data)
            }).catch(error => {
                reject(error)
            })
        })
    }

    public updateMerchantData = (items:Array<BulkUpdateItem>): Promise<ServiceResponse<Boolean>> => {
        return new Promise<ServiceResponse<Boolean>>((resolve, reject) => {
            let url = `${this.config.serviceUrl!}/product_service/updateMerchantData`
            axios.post(url, items).then(response => {
                if (response.data.success) {
                    resolve(response.data)
                } else {
                    reject(new Error(response.data.message))
                }
            }).catch(error => {
                reject(error)
            })
        })
    }

    

    public getProduct = (productId: string, culture: string = 'en_US'): Promise<ServiceResponse<Product>> => {
        return new Promise<ServiceResponse<Product>>((resolve, reject) => {
            let url = `${this.config.serviceUrl!}/product_service/getProduct?productId=${productId}&culture=${culture}`
            axios.get(url, {
                headers: {

                }
            }).then(response => {

                if (response.data.success) {
                    resolve(response.data)
                } else {
                    reject(new Error(response.data.message))
                }

            }).catch(error => {
                reject(error)
            })
        })
    }

    public getMultipleProducts = (productIds: Array<string>, culture: string = 'en_US'): Promise<ServiceResponse<Product>> => {
        return new Promise<ServiceResponse<Product>>((resolve, reject) => {
            let productIdListStr = productIds.join('|')
            let url = `${this.config.serviceUrl!}/product_service/getMultipleProducts?productIds=${productIdListStr}&culture=${culture}`
            axios.get(url, {
                headers: {

                }
            }).then(response => {

                if (response.data.success) {
                    resolve(response.data)
                } else {
                    reject(new Error(response.data.message))
                }

            }).catch(error => {
                reject(error)
            })
        })
    }

    public getCategories = (culture: string = 'en_US'): Promise<ServiceResponse<CategoryTree>> => {
        return new Promise<ServiceResponse<CategoryTree>>((resolve, reject) => {
            let url = `${this.config.serviceUrl!}/product_service/getCategories?culture=${culture}`
            axios.get(url, {
                headers: {
                    
                }
            }).then(response => {

                if (response.data.success) {
                    resolve(response.data)
                } else {
                    reject(new Error(response.data.message))
                }

            }).catch(error => {
                reject(error)
            })
        })
    }

    public getListProducts = (listId:string, culture: string = 'en_US'): Promise<ServiceResponse<List>> => {
        return new Promise<ServiceResponse<List>>((resolve, reject) => {
            let url = `${this.config.serviceUrl!}/product_service/getList?culture=${culture}&listId=${listId}`
            axios.get(url, {
                headers: {
                    
                }
            }).then(response => {

                if (response.data.success) {
                    resolve(response.data)
                } else {
                    reject(new Error(response.data.message))
                }

            }).catch(error => {
                reject(error)
            })
        })
    }


}