
import RBS from './index'

const a = new RBS({
    projectId: "7b7ecec721d54629bed1d3b1aec210e8",
    developerId: "rbs",
    serviceId: "basicauth",
    secretKey: "awesomesecretkey"
})

a.send({
    action: 'rbs.core.request.GENERATE_CUSTOM_TOKEN',
    data: {
        userId: 'userId123',
        userRoleId: 'sdfsdfsdf'
    },
    onSuccess: (resp:any) => {
        console.log("ON SUCCESS", resp)
    },
    onError: (e:any) => {

    }
})


// const a = new RBS({
//     projectId: "7b7ecec721d54629bed1d3b1aec210e8",
// })

// a.send({
//     action: 'rbs.oms.request.GET_MY_ORDERS1',
//     onSuccess: (resp:any) => {
//         console.log("ON SUCCESS 1", resp)
//     },
//     onError: (e:any) => {

//     }
// })

// a.send({
//     action: 'rbs.oms.request.GET_MY_ORDERS2',
//     onSuccess: (resp:any) => {
//         console.log("ON SUCCESS 2", resp)
//     },
//     onError: (e:any) => {

//     }
// })

// a.send({
//     action: 'rbs.oms.request.GET_MY_ORDERS3',
//     onSuccess: (resp:any) => {
//         console.log("ON SUCCESS 3", resp)
//     },
//     onError: (e:any) => {

//     }   
// })

// a.send({
//     action: 'rbs.oms.request.GET_MY_ORDERS4',
//     onSuccess: (resp:any) => {
//         console.log("ON SUCCESS 4", resp)
//     },
//     onError: (e:any) => {

//     }
// })