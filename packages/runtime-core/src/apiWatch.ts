import { hasChanged, isObject } from "@vue/reactivity"
import { EMPTY_OBJ } from "@vue/shared"
import { ReactiveEffect } from "packages/reactivity/src/effect"
import { isReactive } from "packages/reactivity/src/reactive"
import { queuePreFlushCb } from "./scheduler"

//监视属性配置类型接口
export interface WatchOptions<immediate = boolean>{
    immediate?:immediate
    deep?:boolean
}

//外部入口函数
export function watch(source,cb:Function,options?:WatchOptions){
    return doWatch(source,cb,options)
}

//watch在这里实现
function doWatch(source,cb:Function,{immediate,deep}:WatchOptions = EMPTY_OBJ){
    let getter:()=>any

    //source是监听的源
    if(isReactive(source)){
        getter = ()=>source
        //如果是reactive类型，肯定自动deep
        deep = true
    }else{
        getter = ()=>{}
    }

    //======在此进行依赖收集=======//
    if(cb&&deep){
        //本质：遍历所有source，完成依赖触发
        const baseGetter = getter
        //等同于传进去了source 
        getter = ()=>traverse(baseGetter())
    }

    //======在此存储oldvalue值=======//
    let oldValue = {}

    //======这里就是包装好的cb=======//
    //job每次执行相当于cb执行一次
    const job = ()=>{
        if(cb){
            const newValue = effect.run()
            if (deep||hasChanged(newValue,oldValue)){
                cb(newValue,oldValue)
                //新值变旧值存起来
                oldValue = newValue
            }
        }
    }

    //======在此定义调度器，变为异步=======//
    //作用就在这里，把这些job变为异步的
    let scheduler = ()=>queuePreFlushCb(job)

    //======在此定义effect，借助scheduler实现监视回调=======//
    const effect = new ReactiveEffect(getter,scheduler)

    //======在此执行effect.run，绑定上activeEffect，当然回调啥时候执行另说=======//
    if(cb){
        if(immediate){
            //立刻触发回调
            job()
        }else{
            //不然就拿到旧值就行了，本质这个run的fn就是上面的getter
            //此处直接新值变旧值
            oldValue = effect.run()
        }
    }else{
        //没有回调的话直接就run，作用是activeEffect为此
        effect.run()
    }

    return ()=>{
        effect.stop()
    }
}

export function traverse(value:unknown){
    if(!isObject(value)){
        return value
    }
    //如果是对象，就递归去遍历一下
    for (const key in value as object){
        //递归地去触发get
        traverse((value as object)[key])
    }
    return value
}