import { isFuntion, isObject } from "@vue/reactivity"
import { isString } from "@vue/shared"
import { normalizeClass } from "packages/shared/src/normalizeProp"
import { ShapeFlags } from "packages/shared/src/shapeFlag"

//三个内置的type格式
//其中Text正常字符串，Comment为注释，Fragment为片段,当然这是渲染的时候再做改变
export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Comment = Symbol('Comment')

export interface VNode{
    el: any
    //相比源码省略了好多
    __v_isVNode:true
    type:any
    props:any
    children:any
    shapeFlag:number
    key:any
}

//判断是不是VNode
export  function isVNode(val:any){
    return val?val.__v_isVNode:false
}
//判断是不是同一个VNode
export function isSameVNodeType(n1:VNode,n2:VNode){
    return n1.type === n2.type && n1.key === n2.key
}

//创建VNode前先指定类型
export { createVNode as createElementVNode}
export function createVNode(type,props,children?):VNode{
    //一连串三元表达式判断是什么类型
    const shapeFlag = isString(type)?ShapeFlags.ELEMENT
                      :isObject(type)?ShapeFlags.STATEFUL_COMPONENT:0

    if (props) {
		// 处理 class
		let { class: klass, style } = props
		if (klass && !isString(klass)) {
			props.class = normalizeClass(klass)
		}
	}

    return creatBaseVNode(type,props,children,shapeFlag)
}

//创建VNode对象
function creatBaseVNode(type,props,children,shapeFlag){
    const vnode = {
        __v_isVNode:true,
        type,
        props,
        shapeFlag,
        key:props?.key || null
    }as VNode

    //解析children，然后给父vnode搞完善
    normalizeChileren(vnode,children)

    return vnode
}

//将children标准化搞成Vnode的函数
export function normalizeChileren(vnode:VNode,children:unknown){
    //根据状态解析
    let type = 0
    const { shapeFlag } = vnode
    if(children == null){
        //1.如果children是 空
    }else if(Array.isArray(children)){
        //2.如果children是 Array
        type = ShapeFlags.ARRAY_CHILDREN

    }else if(isObject(children)){
        //3.如果children是 对象

    }else if(isFuntion(children)){
        //4.如果children是 函数

    }else{
        //5.如果children是 字符串
        //转一下,现在有了children的type
        children = String(children)
        type = ShapeFlags.TEXT_CHILDREN
    }

    vnode.children = children
    vnode.shapeFlag |= type
}

export function createCommentVNode(text){
    return createVNode(Comment,null,text)
}