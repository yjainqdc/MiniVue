import { createVNodeCall, NodeTypes } from "../ast"

//转化Element-闭包
//核心作用：新增了codegenNode属性
export const transformElement = (node,context) => {
    return function postTransformElement(){
        node = context.currentNode
        //不是element节点就不用干了
        if(node.type !== NodeTypes.ELEMENT){
            return
        }
        const { tag } = node //如：'div'
        let vnodeTag = `"${tag}"` //带变量的字符串
        let vnodeProps = []
        let vnodeChildren = node.children

        //transform的关键就是新增了codegenNode属性
        node.codegenNode = createVNodeCall(context,vnodeTag,vnodeProps,vnodeChildren)
    }
}