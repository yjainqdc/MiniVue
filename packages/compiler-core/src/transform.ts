import { isString } from "@vue/shared"
import { NodeTypes } from "./ast"
import { isSingleElementRoot } from "./hoistStatic"
import { TO_DISPLAY_STRING } from "./runtimeHelpers"

export interface TransFormContext{
    root
    parent:ParentNode | null //转化时的父节点
    childIndex:number 
    currentNode //当前处理的节点
    helpers:Map<symbol,number> //render函数中生成的节点的函数
    helper<T extends symbol>(name:T):T //处理中的helper
    nodeTransforms:any[] //转化方法
    replaceNode(node):void //v-if替换方法
}



//创建上下文对象
export function createTransformContext(root,{nodeTransforms = []}){
    const context:TransFormContext = {
        nodeTransforms,
        root,
        helpers: new Map(),
        currentNode: root,
        childIndex: 0,
        helper(name) { //配合Helpes，往里面放东西
            const count = context.helpers.get(name) || 0
            context.helpers.set(name, count + 1)
            return name
        },
        parent: null,
        replaceNode(node){
            //v-if让当前正在处理节点换成ifVnode
            context.parent!.children[context.childIndex] = context.currentNode = node
        }
    }
    return context
}

//转化总函数
export function transform(root,options){
    const context = createTransformContext(root,options)
    //遍历转化节点
    tranverseNode(root,context)
    console.log(context)
    //创建根节点
    createRootCodegen(root)

    //给root导入helpers，是个map，key是函数
    root.helpers = [...context.helpers.keys()]
    root.component = []
    root.directives = []
    root.imports = []
    root.hoists = []
    root.temps = []
    root.cached = []
}

//遍历转化节点的函数-深度优先原则
/*
 * 转化的过程分为两个阶段：
 * 1. 进入阶段：存储所有节点的转化函数到 exitFns 中
 * 2. 退出阶段：执行 exitFns 中缓存的转化函数，且一定是倒叙的。因为只有这样才能保证整个处理过程是深度优先的
*/
export function tranverseNode(node,context:TransFormContext){
    //当前正在执行的函数
    context.currentNode = node
    const { nodeTransforms } = context
    const exitFns:any = []

    for(let i = 0;i<nodeTransforms.length;i++){
        //去执行每一个个transform，如果type不对，会自动return的
        //对了会返回闭包函数的,闭包也保存了当时传进去的参数
        //利用了递归的原理，实现了DFS
        const onExit = nodeTransforms[i](node,context)
        if(onExit){  
            if(Array.isArray(onExit)){
                //指令处理加得多
                exitFns.push(...onExit)
            }else{
                exitFns.push(onExit)
            }
        }

        //处理指令的时候切换过currentNode，现在校准一下node
        if(!context.currentNode){
            return
        }else{
            //防止处理ifnode找不到currentNode
            node = context.currentNode
        }

    }
    switch(node.type){
        case NodeTypes.IF_BRANCH:
        case NodeTypes.ELEMENT:
        case NodeTypes.ROOT:
            //处理子节点，函数里调用了tranverseNode，子节点的onExit会存到exitFns
            tranverseChildren(node,context)
            break
        case NodeTypes.INTERPOLATION:
            //处理复合表达式
            //先传入工具函数，TO_DISPLAY_STRING帮助变量读取值
            context.helper(TO_DISPLAY_STRING) 
            break
        case NodeTypes.IF:
            //处理if指令
            //IFNODE包含了branches
            for(let i =0;i<node.branches.length;i++){
                tranverseNode(node.branches[i],context)
            }
            break
    }

    context.currentNode = node
    let i = exitFns.length
    while(i--){
        exitFns[i]()
    }
}


//处理子节点的函数
function tranverseChildren(parent,context:TransFormContext){
    parent.children.forEach((node,index) => {
        context.parent = parent
        context.childIndex = index
        tranverseNode(node,context)
    });
}

//创建根节点
function createRootCodegen(root){
    const {children} = root
    //vue2支持单个根节点,就先处理单个吧
    if(children.length === 1){
        const child = children[0]
        if(isSingleElementRoot(root,child)&&child.codegenNode){
            root.codegenNode = child.codegenNode
        }
    }

    //vue3支持多个根节点
}

//***********************************************************************/
//处理某一个指令，并生成exitFns
export function createStructuralDirectiveTransform(name:string|RegExp,fn){
    //name为正则或者字符串，所以有下边这一出,判断是不是当前处理的指令
    const matches = isString(name)? (n:string)=>n===name : (n:string)=>name.test(n)
    return (node,context)=>{
        if(node.type === NodeTypes.ELEMENT){
            const {props} = node
            const exitFns:any = []
            //循环看看是不是当前需要处理的指令
            for(let i = 0;i<props.length;i++){
                const prop = props[i]
                //props，先仅处理指令
                if(prop.type === NodeTypes.DIRECTIVE && matches(prop.name)){
                    props.splice(i,1)
                    i-- //拿出来了，就在原props删掉就行了
                    const onExit = fn(node,prop,context) //生成闭包，并返回赋值给onExit
                    if(onExit)exitFns.push(onExit)
                }
            }
            // 返回包含所有函数的数组
            return exitFns
        }
    }
}