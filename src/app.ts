import RBS, {RESPONSE_TYPE, RbsRegion, RBSAuthChangedEvent, ServiceResponse} from './index'

// const a = new RBS({
//     projectId: "7b7ecec721d54629bed1d3b1aec210e8",
//     developerId: "rbs",
//     serviceId: "basicauth",
//     secretKey: "awesomesecretkey"
// })

// a.send({
//     action: 'rbs.core.request.GENERATE_CUSTOM_TOKEN',
//     data: {
//         userId: 'userId123',
//         userRoleId: 'sdfsdfsdf'
//     },
//     onSuccess: (resp:any) => {
//         console.log("ON SUCCESS", resp)
//     },
//     onError: (e:any) => {

//     }
// })

const rbs = RBS.getInstance()
rbs.init({
    projectId: "3b7eea955170401685ec7ac0187ef787",
    region: RbsRegion.euWest1Beta,
    anonymTokenTTL: 10000000
})

// rbs.authStatus.subscribe((event:RBSAuthChangedEvent) => {
    
// })

    // regionConfiguration: {
    //     getUrl: 'https://core-test.rettermobile.com',
    //     url: 'https://core-internal-beta.rtbs.io'
    // }

    // rbsUrl: 'https://core-test.rettermobile.com',
    // developerId: 'rbs',
    // serviceId: 'pim',
    // secretKey: 'awesomesecretkey'

// rbs.send({
//     action: 'rbs.businessuserauth.request.LOGIN',
//     data: {
//         "email": "email@test.com",
//         "password": "password"
//     },
//     onSuccess: (resp: any) => {
//         console.log("ON SUCCESS 1", resp)

//         rbs.send

//     },
//     onError: (e: any) => {

//     }
// })

const main = async () => {

    // let token = await rbs.getAnonymToken(500)



    // console.log(token)

    let p:Array<Promise<string | Array<ServiceResponse>>> = []

    // console.log(await rbs.generateGetActionUrl({
    //     action: 'rbs.storage.get.IMAGE',
    //     data: {
    //         something: 1
    //     }
    // }))

    p.push(rbs.send({
        action: 'rbs.address.get.COUNTRIES',

        data: {
            something: 1
        }
    }))

    for(let i = 0; i<100; i++) {
        p.push(rbs.generateGetActionUrl({
            action: 'rbs.storage.get.GET_IMAGE',
            data: {
                imageId: "920c42c9-72a3-435d-97f7-0a3f932a96c1",
                width: 500,
                height: 500
            }
        }))
    }



    let result = await Promise.all(p)
    
    console.log(JSON.stringify(result, null, 4))


    // const url = await rbs.generateGetActionUrl({
    //     action: "rbs.some.get.SOMETHING",
    //     data: {
    //         hey: 1
    //     }
    // })
    
    // console.log('url', url)

    // try {

    //     let resp = await rbs.send({
    //         action: 'rbs.address.get.COUNTRIES',

    //         data: {
    //             something: 1
    //         }
    //     })
    //     console.log(JSON.stringify(resp, null, 4))

    // } catch (err) {
    //     console.log('err', err)
    // }




    // let result = await rbs.send({
    //     action: "rbs.businessuserauth.request.LOGIN",
    //     data: {
    //         "email": "root",
    //         "password": "12345"
    //     }
    // })
        
    // console.log("Result: ", result)

    // let authResult = await rbs.authenticateWithCustomToken(result[0].response.customToken)

    // console.log('authResult', authResult)
    
    // console.log(authResult)

    // await rbs.send({
    //     action: "rbs.product.request.SEARCH",
    //     data: {
    //         "searchTerm": "dove"
    //     }
    // })

    // let searchResult = await send("rbs.product.request.SEARCH", {
    //     "searchTerm": "dove"
    // })


}

// const send = (action: string, data: any): Promise<any> => {

//     return new Promise((resolve, reject) => {

//         rbs.send({
//             action,
//             data,
//             onSuccess: (resp: any) => {
//                 resolve(resp)
//             },
//             onError: (e: any) => {
//                 reject(e)
//             }
//         })

//     })

// }

// const authenticateWithCustomToken = (customToken:string): Promise<any> => {
//     return new Promise((resolve, reject) => {
//         rbs.authenticateWithCustomToken(customToken, (resp) => {
//             resolve(resp)
//         }, (e) => {
//             reject(e)
//         })
//     })
// }

main()

