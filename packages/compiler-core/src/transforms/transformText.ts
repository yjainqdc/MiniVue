import { createComponentInstance } from "packages/runtime-core/src/component"
import { NodeTypes } from "../ast"
import { isText } from "../utils"

//转Text
//核心作用：将相邻的文本节点和表达式节点合并为一个表达式
/**
 * 例如:
 * <div>hello {{ msg }}</div>
 * 上述模板包含两个节点：
 * 1. hello：TEXT 文本节点
 * 2. {{ msg }}：INTERPOLATION 表达式节点
 * 这两个节点在生成 render 函数时，需要被合并： 'hello' + _toDisplayString(_ctx.msg)
 * 那么在合并时就要多出来这个 + 加号。
 * 例如：
 * children:[
 * 	{ TEXT 文本节点 },
 *  " + ",
 *  { INTERPOLATION 表达式节点 }
 * ]
 */
//处理孩子
export const transformText = (node,context) =>{
    if(
        //transformText只处理以下逻辑的孩子
        node.type === NodeTypes.ROOT ||
        node.type === NodeTypes.ELEMENT ||
        node.type === NodeTypes.FOR ||
        node.type === NodeTypes.IF_BRANCH
    ){
        return()=>{
            const children = node.children
            let currentContainer
            for(let i = 0; i<children.length;i++){
                const child  = children[i]
                if(isText(child)){
                    for(let j = i+1; j<children.length;j++){
                        const childNext = children[j]
                        if(isText(childNext)){
                            if(!currentContainer){
                                //先只放了第一个Text节点
                                //在这里改变了孩子节点，这里改变了node，完成了转化
                                currentContainer = children[i] = createCompoundExpression([child],child.loc)
                            }
                            //如果相邻两个都是文本节点
                            currentContainer.children.push(`+`,childNext)
                        }
                        //处理好一个了，就删掉一个j
                        children.splice(j,1)
                        j--
                    }
                }else{
                    //第一个节点是Text，第二个不是
                    currentContainer = undefined
                    break
                }
            }
        }
    }
}


//创建符合表达式节点
export function createCompoundExpression(children,loc){

     return{
         type:NodeTypes.COMPOUND_EXPRESSION,
         loc,
         children
     }
}


