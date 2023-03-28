import { track, trigger } from "./effect"

const get = createGetter()
const set = createSetter()

//getter
function createGetter(){
    return function get(target:object,key:string|symbol,receiver:object){
        const res = Reflect.get(target,key,receiver)
        //依赖收集，在effect.ts
        track(target,key)
        return res
    }
}

//setter
function createSetter(){
    return function get(target:object,key:string|symbol,value:unknown,receiver:object){
        const res = Reflect.set(target,key,value,receiver) // 得到了布尔值
        //触发依赖，在effect.ts
        trigger(target,key,value)
        return res
    }
}

//监视操作
export const mutableHandlers: ProxyHandler<object> = {
    get,
    set
}
