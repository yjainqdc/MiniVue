import { extend } from "."
import { ComputedRefImpl } from "./computed"
import { createDep, Dep } from "./dep"
import { reactive } from "./reactive"

//存储依赖的数据结构targetMap
//========================================================================================================
type KetToDepMap = Map<any,Dep>
const targetMap = new WeakMap<any,KetToDepMap>()
//========================================================================================================
//调度器
type EffectScheduler = (...args:any[])=>any
//传入effect的配置类型接口
export interface ReactiveEffectOptions {
    lazy?:boolean
    scheduler:EffectScheduler
}
//========================================================================================================

//依赖的具体操作
//========================================================================================================
//1.收集依赖
export function track(target:object,key:string|symbol){
    //如果没有被执行的，那就不用track了，也没啥要收集的，因为收集都是在effect第一次执行的时候（触发了get，才到了这里）
    if(!activeEffect)return
    let depsMap = targetMap.get(target)
    //之前没有添加依赖过的话，现在就先新建个键值对
    if(!depsMap){
        targetMap.set(target,(depsMap = new Map()))
    }

    //再查看查看有没有维护dep集合
    let dep = depsMap.get(key)
    if(!dep){
        depsMap.set(key,(dep = createDep()))
    }

    //再给具体的key绑定依赖
    // depsMap.set(key,activeEffect)
    trackEffects(dep)
}
//1.1利用dep依次跟踪key的所有effect(帮助实现一对多)
export function trackEffects(dep:Dep){
    dep.add(activeEffect!)
}


//2.触发依赖
export function trigger(target:object,key:string|symbol,value:unknown){
    //获取当前对象的依赖
    let depsMap = targetMap.get(target)
    if(!depsMap){
        return
    }
    //获取当前对象的当前属性的依赖
    let effects = depsMap.get(key) as Dep
    if(!effect)return

    //依次触发依赖
    // effect.fn() 
    triggerEffects(effects)
}
// 2.1利用dep依次触发key的所有effect(帮助实现一对多)
export function triggerEffects(dep:Dep){
    const effects = Array.isArray(dep) ? dep:[...dep]

    effects.forEach((item)=>{
        //如果computed中有调度器，我们需要执行调度器，有调度器地effect都是计算属性的计算逻辑
        //为了防止一个计算属性再effect中出现吗两次，容易产生死循环，故先执行完计算逻辑再执行其他effect
        if(item.scheduler){
            item.scheduler()
        }
    })
    effects.forEach((item)=>{
        if(!item.computed){
            item.run()
        }
    })
}


//========================================================================================================



//对外暴漏的effectAPI，依赖
//========================================================================================================
//effect 会立即执行传入的函数，并在函数的依赖发生变化时重新运行该函数(依赖函数)
export function effect<T=any>(fn:()=>T,options?: ReactiveEffectOptions){
    //构建ReactiveEffect实例
    const _effect = new ReactiveEffect(fn)

    //合并两个对象，好让effect里面有scheduler
    if(options){
        extend(_effect,options)
    }

    //非懒执行
    if(!options||!options.lazy){
        _effect.run()
    }
  
}

//一个公共标记，保存当前被执行的effect
export let activeEffect: ReactiveEffect|undefined


 //这个类方便存依赖
export class ReactiveEffect<T=any>{

    //计算属性
    computed?:ComputedRefImpl<T>

    constructor(public fn:()=>T,public scheduler:EffectScheduler|null = null){

    }
    run(){
        //标记当前被执行的effect
        activeEffect = this
        return this.fn()
    }
    stop(){}
}
//========================================================================================================
 