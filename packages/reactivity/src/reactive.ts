import { isObject } from "."
import { mutableHandlers } from "./baseHandlers"

export const reactiveMap = new WeakMap<object,any>()

//对外暴漏的reactiveAPI
//========================================================================================================
export function reactive(target:object){
    return createReactiveObject(target,mutableHandlers,reactiveMap)
}


//创建代理对象的函数
function createReactiveObject(
    target:object,
    baseHandlers:ProxyHandler<any>, //proxy接口ProxyHandler
    proxyMap:WeakMap<object,any>
){
    //缓存机制
    const existingProxy = proxyMap.get(target) 
    if(existingProxy){
        return existingProxy //如果已经有了，那就直接返回就好了
    }
    //如果没有就创建
    const proxy = new Proxy(target,baseHandlers)
    proxy.__v_isReactive = true
    //然后维护一下缓存
    proxyMap.set(target,proxy)
    return proxy
}
//========================================================================================================

// ref中的toReactive
//========================================================================================================
//泛型，返回值为T
export const toReactive = <T extends unknown>(value:T):T=>{
    //isObject定义再index
    return isObject(value)?reactive(value as object):value
}
//========================================================================================================

//判断是否是reactive
export function isReactive(val):boolean{
     return !!(val&&val.__v_isReactive)
}