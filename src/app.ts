
import RBS from './index'

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


const rbs = new RBS({
    projectId: "933a51e1c87a9ccc181d21fca91c2aad",
})

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
    let result = await send("rbs.businessuserauth.request.LOGIN", {
        "email": "email@test.com",
        "password": "password"
    })

    let authResult = await authenticateWithCustomToken(result[0].response.customToken)

    // console.log(authResult)

    let searchResult = await send("rbs.product.request.SEARCH", {
        "searchTerm": "dove"
    })

    console.log(searchResult)
}

const send = (action: string, data: any): Promise<any> => {

    return new Promise((resolve, reject) => {

        rbs.send({
            action,
            data,
            onSuccess: (resp: any) => {
                resolve(resp)
            },
            onError: (e: any) => {
                reject(e)
            }
        })

    })

}

const authenticateWithCustomToken = (customToken:string): Promise<any> => {
    return new Promise((resolve, reject) => {
        rbs.authenticateWithCustomToken(customToken, (resp) => {
            resolve(resp)
        }, (e) => {
            reject(e)
        })
    })
}

main()

