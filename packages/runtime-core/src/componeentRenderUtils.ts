import { ShapeFlags } from 'packages/shared/src/shapeFlag'
import { createVNode } from './VNode'

export function normalizeVNnode(child){
    if(typeof child === 'object'){
        return child
    }else{
        return createVNode(Text,null,String(child))
    }
}


//组件相关，创建subTree
export function renderComponentRoot(instance){
    const{vnode,render,data} = instance
 
    let result

    try {
        if(vnode.shapeFlag&ShapeFlags.STATEFUL_COMPONENT){
            //定义的时候传进去的render属性是一个函数，返回值为vnode
            //里面的data都是使用this传在render的，所以需要用call改变this指向
            //其中传两个参数的原因是利用模板生成的render函数需要一个_cts参数，也是变this指向
            result = normalizeVNnode(render!.call(data,data))
        }
    } catch (error) {
        console.log(error);
    }
    return result
}