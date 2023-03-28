import { isObject } from "@vue/reactivity";
import { createVNode, isVNode, VNode } from "./VNode";


//在这里主要对参数进行了一个处理
export function h(type:any,propsOrChildren?:any,children?:any):VNode{
    //首先获取参数长度
    const l = arguments.length

    //如果参数长度为2
    if(l == 2){
        if(isObject(propsOrChildren)&&!Array.isArray(propsOrChildren)){
            if(isVNode(propsOrChildren)){
                //1.如果第二个参数是对象且为VNode，当成children来用
                return createVNode(type,null,[propsOrChildren])
            }
            //2.如果第二个参数是对象，不为VNode，当成props来用
            return createVNode(type,propsOrChildren)
        }else{
            //3.如果第二个参数是数组或字符串，当成children数组来用
            return createVNode(type,null,propsOrChildren)
        }
    }else{
        //如果参数长度大于3
        if(l>3){
            //此情况为一个一个传进来的children
            children = Array.prototype.slice.call(arguments,2)
        }else if(l ===3 && isVNode(children)){
            children = [children]
        }
        return createVNode(type,propsOrChildren,children)
    }
}