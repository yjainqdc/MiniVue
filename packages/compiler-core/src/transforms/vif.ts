import { isString } from "@vue/shared";
import { createCallExpression, createConditionalExpression, createObjectProperty, createSimpleExpression, NodeTypes } from "../ast";
import { CREATE_COMMENT } from "../runtimeHelpers";
import { createStructuralDirectiveTransform, TransFormContext } from "../transform";

// 制造闭包
export const transformIf = createStructuralDirectiveTransform(
    /^(if|else|else-if)$/,
    (node,dir,context)=>{
        //返回的函数就是onExit
        return processIf(node , dir , context , (ifNode,branch,isRoot:boolean)=>{
            //主要干的事是给节点加codegen属性
            let key = 0 
            return ()=>{
                if(isRoot){
                    ifNode.codegenNode = createCodegenNodeForBranch(branch,key,context)
                    // node = ifNode
                }
            }
        })
    })


export function processIf(node , dir , context:TransFormContext , processCodegen?:(ifNode,branch,isRoot:boolean)=>(() => void) | undefined){
    //真正去处理if指令的代码
    if(dir.name === 'if'){
        // 创建 branch 属性
        const branch = createIfBranch(node,dir)
        // 生成 if 指令节点，包含 branches
        const ifNode = {
            type:NodeTypes.IF,
            loc:{},
            branches:[branch],
            codegenNode : undefined
        }
        //当前正在处理的node = ifVnode
        context.replaceNode(ifNode)
        // 生成对应的 codegen 属性
        if(processCodegen){
                return processCodegen(ifNode,branch,true)
        }

    }
} 

//创建 if 指令的 branch 属性节点
function createIfBranch(node,dir){
    return{
        type:NodeTypes.IF_BRANCH,
        loc:{},
        condition:dir.exp,
        children:[node]
    }
}

//添加codegenNode的函数
function createCodegenNodeForBranch(branch,keyIndex,context:TransFormContext){
    if(branch.condition){
        //返回的就是一个节点对象
        return createConditionalExpression( branch.condition , creatChildrenCodegenNode(branch,keyIndex) , createCallExpression(context.helper(CREATE_COMMENT),['"v-if"','true']))
        //其中第三个参数alernate，代表的是v-if的替代方案，就是不渲染v-if，渲染其他的，就是注释
    }else{
        return creatChildrenCodegenNode(branch,keyIndex)
    }
}

//创建子节点的codegen
function creatChildrenCodegenNode(branch,keyIndex:number){
    //创建对象的属性节点
    const keyProperty = createObjectProperty('key',createSimpleExpression(`${keyIndex}`,false))

    const { children } = branch
    const firstChild = children[0]
    const ret = firstChild.codegenNode
    const vnodeCall = getMemoeryVModeCall(ret)

    //利用keyProperty填充props
    injectProp(vnodeCall,keyProperty)
    return ret
}

//填充props
export function injectProp(node,prop){
    let propsWithInjection
    let props = node.type === NodeTypes.VNODE_CALL? node.props:node.arguments[2]

    if(props === null || isString(props)){
        propsWithInjection = createObjecExpression([prop])
    }
    node.props = propsWithInjection
}

//getMemoeryVModeCall就是花全秀腿模仿一圈源码
function getMemoeryVModeCall(node){return node}

//createObjecExpression,就是生成props
export function createObjecExpression(properties){
    return{
        type:NodeTypes.JS_OBJECT_EXPRESSION,
        loc:{},
        properties
    }
}