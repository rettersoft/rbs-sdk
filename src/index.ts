
import { QueryBuilder } from '../../services/product_service/src/search/queryBuilder'
import { Filter, SearchResponse } from '../../services/product_service/src/search/models'

import axios from 'axios'

const SERVICE_URL = 'http://localhost:3000'
const AGGS_ENDPOINT = '/aggs'
const SEARCH_ENDPOINT = '/search'

interface RBSConfiguration {
    projectId: string
    serviceUrl?: string
}

interface SearchInput {
    userId?:string
    filters: Array<Filter>
    aggs:boolean
}

export class RBSClient {

    config: RBSConfiguration

    constructor(config: RBSConfiguration) {
        this.config = config
        if (!this.config.serviceUrl) this.config.serviceUrl = SERVICE_URL
    }

    search(input:SearchInput = {filters: [], aggs: false}): Promise<SearchResponse> {
        if(!input.userId) throw new Error('UserId is missing')

        return new Promise<SearchResponse>((resolve, reject) => {
            let qsVal = QueryBuilder.filtersToQueryString(input.filters)
            let endpoint = input.aggs ? AGGS_ENDPOINT : SEARCH_ENDPOINT
            let result = axios
                .get(this.config.serviceUrl! + endpoint + '?filters=' + qsVal, {
                    headers: {
                        "user-id": input.userId!
                    }
                })
                .then(function (response) {
                    resolve(response.data)
                })
                .catch(function (error) {
                    reject(error)
                })
        })
    }
};





