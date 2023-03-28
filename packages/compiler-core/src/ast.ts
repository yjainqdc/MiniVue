import { isString } from "@vue/shared";
import { CREATE_ELEMENT_VNODE } from "./runtimeHelpers";

/**
 * 节点类型（我们这里复制了所有的节点类型，但是我们实际上只用到了极少的部分）
 */
 export const enum NodeTypes {
	ROOT,
	ELEMENT,
	TEXT,
	COMMENT,
	SIMPLE_EXPRESSION,
	INTERPOLATION,
	ATTRIBUTE,
	DIRECTIVE,
	// containers
	COMPOUND_EXPRESSION,
	IF,
	IF_BRANCH,
	FOR,
	TEXT_CALL,
	// codegen
	VNODE_CALL,
	JS_CALL_EXPRESSION,
	JS_OBJECT_EXPRESSION,
	JS_PROPERTY,
	JS_ARRAY_EXPRESSION,
	JS_FUNCTION_EXPRESSION,
	JS_CONDITIONAL_EXPRESSION,
	JS_CACHE_EXPRESSION,

	// ssr codegen
	JS_BLOCK_STATEMENT,
	JS_TEMPLATE_LITERAL,
	JS_IF_STATEMENT,
	JS_ASSIGNMENT_EXPRESSION,
	JS_SEQUENCE_EXPRESSION,
	JS_RETURN_STATEMENT
}

/**
 * Element 标签类型
 */
 export const enum ElementTypes {
	/**
	 * element，例如：<div>
	 */
	ELEMENT,
	/**
	 * 组件
	 */
	COMPONENT,
	/**
	 * 插槽
	 */
	SLOT,
	/**
	 * template
	 */
	TEMPLATE
}


export function createVNodeCall(context,tag,props?,children?){
    if(context){
        //向helps放置对应的symbol,是一个函数名，在runtimeHelper.ts中查看
        //感觉这个地方有点像python的注册机制
        context.helper(CREATE_ELEMENT_VNODE)
    }

    return{
        type:NodeTypes.VNODE_CALL,
        tag,
        props,
        children,
    }
}

export function createConditionalExpression(test,consquent,alernate,newline = true){
	return{
		type:NodeTypes.JS_CONDITIONAL_EXPRESSION,
		test,
		consquent,
		alernate,
		loc:{}
	}
}

//创建对象的属性节点
export function createObjectProperty(key,value){
	return {
		type:NodeTypes.JS_PROPERTY,
		loc:{},
		key:isString(key)?createSimpleExpression(key,true):key,
		value
	}
}

//创建简单的表达式节点
export function createSimpleExpression(content,isStatic){
	return {
		type:NodeTypes.JS_PROPERTY,
		loc:{},
		content,
		isStatic
	}
}

//创建注释节点：v-if用
export  function createCallExpression(callee,args){
	return{
		type:NodeTypes.JS_CALL_EXPRESSION,
		loc:{},
		callee,
		arguments:args
	}
}


