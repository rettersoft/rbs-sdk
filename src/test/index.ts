import RBSClient from '../index'

const rbsClient = new RBSClient({
    enableLogs: true
})

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