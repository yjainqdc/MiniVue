import { isString } from "@vue/shared"
import { NodeTypes } from "./ast"
import { helperNameMap, TO_DISPLAY_STRING } from "./runtimeHelpers"
import { getVNodeHelper } from "./utils"

//拼接个结构赋值里面的那个字符串：createVNode:_createVNode
const aliasHelper = (s:symbol) => `${helperNameMap[s]}:_${helperNameMap[s]}`

//genetate上下文对象
function createCodegenContext(ast){
    const context = {
        code:'', //拼接的函数字符串
        runtimeGlobalName:'MiniVue',
        source:ast.loc.source,
        indentLevel:0,//缩进
        isSSR:false,
        helper(key){
            return `_${helperNameMap[key]}`
        },
        push(code){
            context.code += code
            //拼接render函数字符串
        },
        newline(){
            newline(context.indentLevel)
            //换行
        },
        indent(){
            newline(++context.indentLevel)
            //进
        },
        deindent(){
            newline(--context.indentLevel)
            //缩
        }
    }
    return context
    
function newline(n:number){
    context.code += '\n'+``.repeat(n)
}
}



//jsast生成render函数并返回
export function generate(ast){
    const context = createCodegenContext(ast)
    const {push,newline,indent,deindent} = context
    //开始拼接
    //首先是前置代码
    getFunctiopnPreamble(context)

    //函数头：function render(_ctx,_cache)
    const functionName = `render`
    const args = ['_ctx','_cache']
    const signature = args.join(',')
    push(`function ${functionName}(${signature}){`)
    indent()

    //添加with(_ctx)
    push('with(_ctx) {')
    indent()

    //第一行：const { createElementVNode: _createElementVNode } = _Vue
    const hasHelps = ast.helpers.length>0
    if(hasHelps){
        push(`const { ${ast.helpers.map(aliasHelper).join(',')} } = _Vue`)
        push('\n')
        newline()
    }

    //第二行节点：return _createElementVNode("div"，[]，["hello word"])
    newline()
    push(`return `)
    if(ast.codegenNode){
        genNode(ast.codegenNode,context)
    }else{
        push(` null`)
    }

    //最后的大括号
    deindent()
    push('}') //with的
    deindent()
    push('}') //总的

    return{
        ast,
        code:context.code
    }
}
//----------------------------------------------------------------------------
//处理节点的那行代码生成：return _createElementVNode("div"，[]，["hello word"]) 
function genNode(node,context){
    switch(node.type){
        case NodeTypes.VNODE_CALL:
            genVNodeCall(node,context)
            break
        case NodeTypes.TEXT:
            //如果是纯文本节点直接返回
            genText(node,context)
            break
        case NodeTypes.SIMPLE_EXPRESSION: //复合表达式
            genExpression(node,context)
            break
        case NodeTypes.INTERPOLATION: //插值表达式
            genInterpolation(node,context)
            break
        case NodeTypes.COMPOUND_EXPRESSION: //双大括号语法
            genCompoundExpression(node,context)
            break
        case NodeTypes.IF: //本质也是Element
        case NodeTypes.ELEMENT: //这种一般是嵌套，生产孩子时使用到
            genNode(node.codegenNode,context)
            break
        case NodeTypes.JS_CONDITIONAL_EXPRESSION:
            genConditionalExpression(node,context) //就是搞那个三元表达式的内容
            break
        case NodeTypes.JS_CALL_EXPRESSION:
            genCallExpression(node,context)
            break
             
    }
}
//----------------------------------------------------------------------------

//v-if的三元表达式
/*
isShow
 ? _createELementVNode("h1"，null，["你好，世界"])
 : _createCommentVNode("v-if"，true)
*/
function genConditionalExpression(node,context){
    const { test,newline:needNewLine,consquent,alernate } = node
    const { push,indent,deindent,newline } = context
    if(test.type === NodeTypes.SIMPLE_EXPRESSION){
        genExpression(test,context) //就是处理三元表达式的第一元，isShow
    }
    needNewLine && indent()
    context.indentLevel++
    //问号
    needNewLine || push(` `)
    push(`?`)
    //处理满足条件的表达式consquent
    genNode(consquent,context)
    context.indentLevel--
    needNewLine&&newline()
    needNewLine||push(` `)
    //冒号
    push(`:`)
    //如果不等，有可能后边有else节点
    const isNested = alernate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
    if(!isNested)context.indentLevel++
    //处理不满足条件的表达式alernate
    genNode(alernate,context)
    if(!isNested)context.indentLevel--

    needNewLine&&deindent()
}

//v-else处理：就是三元不断拼接
//: _createCommentVNode("v-if"，true)【这里生成node后边的东西】
function genCallExpression(node,context){
    const { push,helper } = context
    const callee = isString(node.callee)?node.callee:helper(node.callee)
    push(callee+`(`)
    genNodeList(node.arguments,context)
    push(`)`)
}


//==================================上面是指令处理===================================
//如果是纯文本节点
function genText(node,context){
    context.push(JSON.stringify(node.content))
}
//创建节点的函数
function genVNodeCall(node,context){
    //_createElementVNode(
    const { push,helper } = context
    const { tag,props,children,patchFlag,dynamicProps,directives,isBlock,disableTracking,isComponent } = node
    //获取使用的函数是CREATE_VNODE还是CREATE_ELEMENT_VNODE
    const callHelper = getVNodeHelper(context.isSSR,isComponent)
    push(helper(callHelper)+`(`)
    //参数"div"，[]，["hello word"]
    const args = genNullableArgs([tag,props,children,patchFlag,dynamicProps])
    genNodeList(args, context)
    push(')')
}

//处理一下参数"div"，[]，["hello word"],去null
function genNullableArgs(args:any[]){
    let i = args.length
    //整理出有效的参数 
    while(i--){
        if(args[i]!=null)break
    }
    return args.slice(0,i+1).map(arg=>arg||`null`)
}
//处理一下参数"div"，[]，["hello word"]
function genNodeList(nodes,context){
    const { push,newline } = context
    for(let i = 0;i<nodes.length;i++){
        const node = nodes[i]
        if(isString(node)){
            push(node)
        }else if(Array.isArray(node)){
            genNodeListAsArray(node,context)
        }else{
            genNode(node,context) //对象：递归处理
        }
        if(i<nodes.length-1){
            push(',') //参数之间逗号分割
        }
    }
}

//处理数组参数
function genNodeListAsArray(nodes,context){
    context.push('[')
    genNodeList(nodes,context) //递归处理 
    context.push(']')
    
}


 //前置代码：const _Vue = MiniVue
function getFunctiopnPreamble(context){
    const {push,runtimeGlobalName,newline} = context
    const VueBinding = runtimeGlobalName
    push(`const _Vue = ${VueBinding}`)
    newline()
    push(`return `)
}

//EXPRESSION
function genExpression(node,context){
    const {content,isStatic} = node
    context.push(isStatic?JSON.stringify(content):content)
}
//INTERPOLATION
function genInterpolation(node,context){
    //主要任务把dispaly函数插进来
    const {push,helper} = context
    push(`${helper(TO_DISPLAY_STRING)}(`)
    genNode(node.content,context) //此时content是变量名字比如：obj.name
    push(')')
}
//CompoundExpression: obj.name + '你好'
function genCompoundExpression(node,context){
    //本质上对其中的children分别处理
    for(let i = 0;i<node.children.length;i++){
        const child = node.children[i]
        //如果是字符串直接push就行了
        if(isString(child)){
            context.push(child)
        }else{
            // 其他的再走一遍
            genNode(child,context)
        }
    }

}