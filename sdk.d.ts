declare module "rbs-core/services/product_service/src/search/models" {
    export interface FilterValue {
        label?: string;
        value?: string;
        minValue?: number;
        maxValue?: number;
        filtered?: boolean;
        count?: number;
    }
    export class Filter {
        filterId: string;
        filterType: string;
        fieldName: string;
        label?: string;
        values?: Array<FilterValue>;
        order?: number;
        totalCount?: number;
        prefix?: string;
        postfix?: string;
        constructor();
    }
    export interface ProjectSearchConfiguration {
        filters: Array<Filter>;
        searchProjectionFields: Array<string>;
        categories: Array<Category>;
        textSearchFields: Array<TextSearchField>;
        locales: Array<string>;
        loc_keys: any;
    }
    interface TextSearchField {
        fieldName: string;
        boost: number;
    }
    interface Category {
        categoryId: string;
        filters: Array<string>;
    }
    class SearchFilterValue {
        filterId: string;
        filterValues: Array<string>;
        constructor();
    }
    export class SearchRequest {
        categoryId?: string;
        searchTerm?: string;
        filters?: Array<SearchFilterValue>;
        searchConfiguration: ProjectSearchConfiguration;
        from?: number;
        size?: number;
        culture?: string;
        constructor();
    }
    interface ProductImageUrl {
        small: string;
        medium: string;
        large: string;
    }
    interface ProductImage {
        isDefault: boolean;
        url: ProductImageUrl;
    }
    export interface Product {
        id?: string;
        images?: Array<ProductImage>;
        attributes?: Array<ProductAttribute>;
    }
    export interface ProductAttribute {
        fieldName: string;
        fieldNameLabel: string;
        value: string;
        valueLabel: string;
        attType: string;
    }
    export class SearchResponse extends SearchRequest {
        products?: Array<Product>;
        aggregations?: Array<Filter>;
    }
    export class Query {
        searchQuery: any;
        aggsQuery: any;
    }
}
declare module "rbs-sdk/src/index" {
    import { Filter, SearchResponse } from "rbs-core/services/product_service/src/search/models";
    interface RBSConfiguration {
        projectId: string;
        serviceUrl?: string;
    }
    export class RBSClient {
        config: RBSConfiguration;
        constructor(config: RBSConfiguration);
        search(filters: Array<Filter>, aggs?: boolean): Promise<SearchResponse>;
    }
}
