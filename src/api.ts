import initializeAxios from './axiosSetup'
import { Observable, defer } from 'rxjs'
import { map, materialize } from 'rxjs/operators'
import Axios from 'axios-observable';
import { AxiosRequestConfig } from 'axios';

// export const axiosRequestConfiguration: AxiosRequestConfig = {
//     baseURL: 'https://core-test.rettermobile.com',
//     responseType: 'json',
//     headers: {
//         'Content-Type': 'application/json',
//     },
//
// };

const instance = Axios.create({
    baseURL: 'https://core-test.rettermobile.com/',
    timeout: 10000,
    headers: {'Content-Type': 'application/json'}
});

// const axiosInstance = initializeAxios(axiosRequestConfiguration);

// const get = <T>(url: string, queryParams?: object): Observable<T> => {
//     return defer(()=> axiosInstance.get<T>(url, { params: queryParams }))
//         .pipe(map(result => result.data));
// };

const post = <T>(url: string, body: object, queryParams?: object): Observable<T | void> => {
    return instance.post<T>(url, body, {
        params: queryParams
    }).pipe(map(result => result ? result.data : undefined))
};

const get = <T>(url: string, queryParams?: object): Observable<T | void> => {
    return instance.get<T>(url, {
        params: queryParams
    }).pipe(map(result => result ? result.data : undefined))
    // return instance.get<T>(url, queryParams).pipe(map(result => result ? result.data : undefined))
};

// const post = <T>(url: string, body: object, queryParams?: object): Observable<T | void> => {
//     return defer(()=> axiosInstance.post<T>(url, body, { params: queryParams }))
//         .pipe(map(result => result.value ? result.value.data : undefined));
// };

// const put = <T>(url: string, body: object, queryParams?: object): Observable<T | void> => {
//     return defer(()=>axiosInstance.put<T>(url, body, { params: queryParams }))
//         .pipe(map(result => result.data));
// };
//
// const patch = <T>(url: string, body: object, queryParams?: object): Observable<T | void> => {
//     return defer(()=> axiosInstance.patch<T>(url, body, { params: queryParams }))
//         .pipe(map(result => result.data));
// };
//
// const deleteR = <T>(url: string, id:number): Observable<T | void> => {
//     return defer(() => (axiosInstance.delete(`${url}/${id}` )))
//         .pipe(map(result => result.data)
//     );
// };

export default { post, get };