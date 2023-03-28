import { isFuntion } from "."
import { Dep } from "./dep"
import { ReactiveEffect, track } from "./effect"
import { trackRefVal, triggerRefVal } from "./ref"

//computed宗旨：别人get我，同ref一样，set时，不仅监听我自己，还得监听我内部用到的
//ComputedRefImpl
//===========================================================================================
export class ComputedRefImpl<T>{
    //依赖
    public dep? :Dep = undefined
    private _value!:T//叹号表示一定存在
    //计算的逻辑，computed的参数
    public readonly effect : ReactiveEffect<T>
    public readonly __v_isRef = true
    //脏属性,值为true表示需要执行run方法,默认为true，肯定先执行一次
    public _dirty = true

    //构造时配置好effect
    //此effect非彼effect，这里是把computed中的计算方式当作effect
    constructor(getter){
        //新建一个ReactiveEffect函数
        //需要去给ReactiveEffect类中添加这个属性
        this.effect = new ReactiveEffect(getter,()=>{
            if(!this._dirty){
                this._dirty = true
                triggerRefVal(this)
            }
        })
        this.effect.computed = this
        }
    //get
    get value(){
        //利用Ref的track实现
        trackRefVal(this)
        //计算属性传入为一个函数，返回值为其值，get一次计算一次
        //当脏状态为真时，执行一次计算逻辑（this.effect）
        if(this._dirty){
            this._dirty = false
            //！！！！重点注释
            //1.此时effect为计算逻辑，会用到其他的响应式变量
            //2.当我这个run起来之后，会触发其他响应式变量的get
            //3.触发get就会触发track把activeEffect add进他们targetMap或refImpl的dep中
            //4.此时activateEffect为计算逻辑，因为我effect.run()了
            //总结：把计算属性里的计算逻辑看作effect，很顺利的给每一个属性加了dep
            this._value = this.effect.run()
        }
        return this._value
    }
    set value(newValue){
 
    }
    
}
//===========================================================================================
//computed
//===========================================================================================
export function computed(getterOrOptions){
    let getter
    //判断传进来的是配置项还是函数 
    const onlyGetter = isFuntion(getterOrOptions)
    if(onlyGetter){
        getter = getterOrOptions
    }
    //创建类实例
    const cRef = new ComputedRefImpl(getter)
    return cRef
} 
//===========================================================================================