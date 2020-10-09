import * as dotenv from "dotenv"
import RBSClient, {SortOrder} from '../index'

dotenv.config()

describe('Product search integration test', function () {
    test('product search with valid userId and valid apiKey', async () => {
        const rbsServer = new RBSClient({
            apiKey: process.env.TEST_SERVICE_API_KEY || "ExampleServiceGeneratedCustomApiKey",
            enableLogs: true,
            endpoint: "server",
            testEnv: true
        })

        const customToken = await rbsServer.generateCustomToken("testUserFromRbsClientSDK")

        const unauthorizedRbsClient = new RBSClient({
            enableLogs: true,
            endpoint: "client",
            testEnv: true
        })

        const authenticateResponse = await unauthorizedRbsClient.clientAuthenticate(customToken)

        let accessTokenPayload = unauthorizedRbsClient.getRbsTokenPayload(authenticateResponse.accessToken)


        const rbsClient = new RBSClient({
            apiKey: authenticateResponse.accessToken,
            enableLogs: true,
            endpoint: "client",
            testEnv: true
        })

        const searchResponse = await rbsClient.search({
            userId: accessTokenPayload.userId,
            filters: [],
            aggs: false,
            categoryId: '',
            culture: 'en_US',
            from: 0,
            size: 20,
            inStock: false,
            sortAttribute: 'price',
            sortOrder: SortOrder.DESC
        })
        console.log(searchResponse.size)
    }, 1000*60)
});

// rbsClient.search({
//     aggs: false,
//     userId: '1',
//     // searchTerm: 'asdf',
//     categoryId: 'cloth',
//     culture: 'tr_TR',
//     filters: [
//         {
//             filterId: 'size',
//             fieldName: 'size',
//             filterType: 'string',
//             values: [{ value: 'l' }]
//         }, {
//             filterId: 'gender',
//             fieldName: 'gender',
//             filterType: 'string',
//             values: [{ value: 'm' }]
//         }, {
//             filterId: 'color',
//             fieldName: 'color',
//             filterType: 'color',
//             values: [{ value: 'red' }]
//         }
//     ]
// }).then(result => {
//     console.log(JSON.stringify(result, null, 4))
//     // console.log('count: ' + result.products?.length)
// }).catch(err => {
//     console.log(JSON.stringify(err, null, 4))
// })