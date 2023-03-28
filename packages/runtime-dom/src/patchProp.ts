import { isOn } from "@vue/shared"
import { patchAttr } from "./modules/attr"
import { patchClass } from "./modules/class"
import { patchEvent } from "./modules/event"
import { patchDOMProps } from "./modules/props"
import { patchStyle } from "./modules/style"

//props操作
export const patchProp = (el:Element,key:string,preValue:any,nextValue:any):void=>{
    //看下会是什么样的props
    if(key === 'class'){
        //class
        patchClass(el,nextValue)
    }else if(key === 'style'){
        //style
        patchStyle(el,preValue,nextValue)
    }else if(isOn(key)){
        //事件
        patchEvent(el,key,preValue,nextValue)
    }else if(shouldSetAsProp(el,key)){
        //不需要setAttribute设置的
        patchDOMProps(el,key,nextValue)
    }else{
        //需要setAttribute设置的
        patchAttr(el,key,nextValue)
    }
}

//判断是否需要setAttr..的方式添加属性
function shouldSetAsProp(el:Element,key:string){
    if(key === 'form'){
        //form是只读的
        return false
    }
    if(key === 'list' && el.tagName === 'INPUT'){
        //必须通过attribute设定
        return false
    }
    if(key === 'type' && el.tagName === 'TEXTAREA'){
        //必须通过attribute设定
        return false
    }
    return key in el

}

