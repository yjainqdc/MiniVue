import { NodeTypes } from "./ast"

//判断是不是单个element根节点
export function isSingleElementRoot(root,child){
    const {children} = root
    return children.length === 1 && (child.type === NodeTypes.ELEMENT || child.type === NodeTypes.IF)
}