import { RBSClient } from '../index'

const rbsClient = new RBSClient({
    projectId: 'muzaffer',
    serviceUrl: 'https://tkn9otec3d.execute-api.eu-west-1.amazonaws.com/prod/product_service'
})

rbsClient.search({
    userId: '1',
    categoryId: 'cloth',
    culture: 'tr_TR',
    filters: [{
        filterId: 'size',
        fieldName: 'size',
        filterType: 'string',
        values: [{ value: 'l' }]
    }, {
        filterId: 'gender',
        fieldName: 'gender',
        filterType: 'string',
        values: [{ value: 'm' }]
    }, {
        filterId: 'color',
        fieldName: 'color',
        filterType: 'color',
        values: [{ value: 'red' }]
    }]
}).then(result => {
    console.log(JSON.stringify(result.products, null, 4))
    console.log(result.products?.length)
})

