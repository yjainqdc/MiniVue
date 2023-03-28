import { hasChanged } from "."
import { createDep, Dep } from "./dep"
import { activeEffect, trackEffects, triggerEffects } from "./effect"
import { toReactive } from "./reactive"

export interface Ref<T=any>{
    value:T
}

export function ref(value?:unknown){
    //shaow设置为false，都会取走toreactive中isObject的校验
    return createRef(value,false)

}

function createRef(rawValue:unknown,shallow:boolean){
    //首先判断，如果是ref的数据，直接返回就行了
    if(isRef(rawValue)){
        return rawValue
    }
    //新建一个和ref专属类别
    return new refImpl(rawValue,shallow)
}

//判断是否为refimpl类型
// r is Ref,Ref是接口
function isRef(r:any):r is Ref{
    //双感叹号强转成布尔值,首先判断了是否为Ref型数据
    return !!(r && r.__v_isRef)
}

class refImpl<T>{
    private _value:T
    private _rawValue:T
    //dep是Dep，默认是undefined
    public dep?: Dep=undefined
    public readonly __v_isRef = true

    constructor(value:T,public readonly __v_isShallow:boolean){
        this._rawValue = value
        //如果不是普通数据类型，ref的value就转成reactive包裹一下
        this._value = this.__v_isShallow ? value : toReactive(value)
    }

    //用get和set修饰，顾名思义，就会再获取 obj.value 执行get，在修改执行set
    //本质上ref使用的是get和set的主动触发value函数
    //***********get value ***********/
    get value(){
        //添加ref类型的依赖
        trackRefVal(this)
        return this._value
    }
    //***********set value ***********/
    set value(newValue){
        if(hasChanged(newValue,this._rawValue)){
            //如果发生了改变
            this._rawValue = newValue
            this._value = toReactive(newValue)
            //toReactive中会判断是不是对象的，如果不是就返回value
            triggerRefVal(this)
        }
    }
}

//============================================================
// 收集依赖
export function trackRefVal(ref){
    //activeEffect是个公共的标记，判断当前的activeEffect是否存在
    //流程：effec中创教你新的ReactiveEffect实例=>构造函数时，令activeEffec=this=>effect.run=>触发get
    if(activeEffect){
        //没有依赖就创建依赖
        //trackEffectsn帮忙实现添加依赖
        trackEffects(ref.dep || (ref.dep = createDep()))

    }
}

//============================================================
//触发依赖
export function triggerRefVal(ref){
    if(ref.dep)triggerEffects(ref.dep)
}

