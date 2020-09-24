import {RBSClient} from './index'

const main = async () => {
    
    let client = new RBSClient({
        projectId: 'default',
    })

    // try {
    //     await client.updateMerchantData([
    //         {
    //             projectId: 'default',
    //             messageType: 'price',
    //             priceItem: {
    //                 currency: 'RUB',
    //                 discountedPrice: 4.5,
    //                 merchantId: 'defaultMerchant',
    //                 price: 10,
    //                 productId: '67138587'
    //             }
    //         }
    //     ])

    // } catch (err) {
    //     console.log(err)
    // }

    try {

        let result = await client.executeStockOperation([{
            productId: '67138587',
            stocks: [{
                qty: -3,
                variant: 'defaultVariant'
            }]
        }], true)

        console.log(result)
    } catch(err) {
        console.log(err)
    }
    
}

main()

