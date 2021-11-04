import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: 'AIzaSyCYKQHVjql92jRX350a7dEaxQUhgkSxiUE',
    authDomain: 'rtbs-c82e1.firebaseapp.com',
    projectId: 'rtbs-c82e1',
    storageBucket: 'rtbs-c82e1.appspot.com',
    messagingSenderId: '814752823492',
    appId: '1:814752823492:web:9cff2c455eebebe646f191',
    measurementId: 'G-HRV8D5ZQ4H',
}

const firebaseApp = initializeApp(firebaseConfig)

export const firestore = getFirestore()

export default firebaseApp
