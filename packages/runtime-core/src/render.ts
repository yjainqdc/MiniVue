import { EMPTY_OBJ, getSequence } from "@vue/shared"
import { ReactiveEffect } from "packages/reactivity/src/effect"
import { ShapeFlags } from "packages/shared/src/shapeFlag"
import { createAppAPI } from "./apiCreateApp"
import { normalizeVNnode, renderComponentRoot } from "./componeentRenderUtils"
import { createComponentInstance, setupComponent } from "./component"
import { queuePreFlushCb } from "./scheduler"
import { Text,Comment, Fragment, VNode, isSameVNodeType } from "./VNode"

//兼容性的方法集合
export interface RenderOptions{
    //为指定el打补丁
    patchProp(el:Element,key:string,preValue:any,nextValue:any):void
    //插入元素，anchor是锚点，插谁前面
    insert(el,parent:Element,anchor?):void
    //创建el
    createElement(type:string):Element
    //为指定el这只text
    setElementText(el:Element,text:string):void
    //删除
    remove(el:Element)
    //创建Text节点
    createText(text:string)
    //设置Text节点
    setText(node,text)
    //创建comment
    createComment(text)
}   

//入口
export function createRender(options:RenderOptions){
    return baseCreatRenderer(options)
}


//巨无霸函数
export function baseCreatRenderer(options:RenderOptions):any{

    //接收一下通用方法,改个名
    const{
        insert:hostinsert,
        createElement:hostcreateElement,
        setElementText:hostsetElementText,
        patchProp:hostpatchProp,
        remove:hostremove,
        createText:hostcreateText,
        setText:hostsetText,
        createComment:hostcreateComment,
    } = options

    /*组件的处理*/
    const processComponent = (oldVNode:VNode,newVNode:VNode,container:Element,anchor:any=null)=>{
        if(oldVNode === null){
            mountCompomemt(newVNode,container,anchor)
        }
    }

    //处理ELEMENT的函数
    const processElement = (oldVNode:VNode,newVNode:VNode,container:Element,anchor:any=null)=>{
        if(oldVNode==null){
            //如果old是空，则执行挂载操作
            mountElement(newVNode,container,anchor)
        }else{
            //更新element
            patchElement(oldVNode,newVNode)
        }
    }
    //处理TEXT
    const processText = (oldVNode:VNode,newVNode:VNode,container:Element,anchor:any=null)=>{
        if(oldVNode==null){
            //挂载
            newVNode.el = hostcreateText(newVNode.children)
            hostinsert(newVNode.el,container,anchor)
        }else{
            //更新
            const el = (newVNode.el = oldVNode.el)
            if(newVNode.children !== oldVNode.children){
                hostsetText(el,newVNode.children)
            }
        }
    }
    //处理comment
    const processCommentNode = (oldVNode:VNode,newVNode:VNode,container:Element,anchor:any=null)=>{
        if(oldVNode==null){
           newVNode.el = hostcreateComment(newVNode.children)
           hostinsert(newVNode.el,container,anchor)
        }else{
            newVNode.el = oldVNode.el
        }
    }
    //处理Fragment:本质是只挂载孩子
    const processFragment = (oldVNode:VNode,newVNode:VNode,container:Element,anchor)=>{
        if(oldVNode == null){
            mountChildren(newVNode.children,container,anchor)
        }else{
            patchChilren(oldVNode,newVNode,container,anchor)
        }
    }
    //----------------------------------------------------------------------
    /*挂载组件 */
    const mountCompomemt = (initialVNode,container,anchor) =>{
        /*创建一个组件专用实例，component.ts中*/
        /*给vnode绑定component */
        initialVNode.component = createComponentInstance(initialVNode)
        const instance = initialVNode.component

        /*主要给instance.render赋值 */
        setupComponent(instance)
        
        /*真正处理渲染组件 */
        setupRenderEffect(instance,initialVNode,container,anchor)
    }

    /*真正挂载渲染组件的函数，直接写在这里了方便看 */
    const setupRenderEffect = (instance,initialVNode,container,anchor)=>{
        const {bm,m} = instance
        /*这里挂载和更新subtree */
        const componentUpdateFn = () => {
            if(!instance.isMounted){
                //生命周期beforemount
                if(bm){
                    bm()
                }
                /*没有挂载过的话就创建一个subTree,其中是组件属性render的返回值 */
                const subTree = (instance.subTree = renderComponentRoot(instance))
                /*挂,subTree现在是vnode */
                patch(null,subTree,container,anchor)
                //搞这个是为了一会更新的时候方便unmount
                initialVNode.el = subTree.el
                instance.isMounted = true
                //生命周期mounted
                if(m){
                    m()
                }                
            }else{
                //组件没有变化，更新组件内的数据，也就是set操作
                let {next,vnode} = instance
                if(!next){
                    next = vnode
                }
                /*vnode是之前的，next是现在的 */
                /*旧树和新树替换 */
                const nextTree = renderComponentRoot(instance)
                const prevTree = instance.subTree
                instance.subTree = nextTree
                //打补丁
                patch(prevTree,nextTree,container,anchor)
                //方便unmount
                next.el = nextTree.el
            }
        }
        /*搞一个effect，scheduler传入的是被promise包裹了一下的函数 */
        const effect = (instance.effect = new ReactiveEffect(componentUpdateFn,()=>queuePreFlushCb(update)))
        /*先run一下，负责渲染 */
        const update = (instance.update = () => {effect.run()})
        update()
    }
    
    //------------------------------------------------------------------------------
    //挂载element
    const mountElement = (vnode:VNode,container:Element,anchor:any=null)=>{3
        const { type,shapeFlag,props } = vnode
        //1.创建element
        const el = (vnode.el = hostcreateElement(type))
        //2.设置文本


        if(shapeFlag&ShapeFlags.TEXT_CHILDREN){
            //先确定得是text的子节点
            hostsetElementText(el,vnode.children)
        }else if(shapeFlag&ShapeFlags.ARRAY_CHILDREN){
            //数组孩子处理，循环挂载，先挂到vnode生成的el上
            mountChildren(vnode.children,el,anchor)
        }
        //3.设置props
        if(props){
            for(const key in props){
                hostpatchProp(el,key,null,props[key])
            }
        }
        //4.插入 
        hostinsert(el,container,anchor)
    }

    //挂载孩子
    const mountChildren = (children,container,anchor) => {
        for(let i = 0;i<children.length;i++){
            const child = (children[i] = normalizeVNnode(children[i]))
            // patchChilren(null,child,container,anchor)
            patch(null,child,container,anchor)
        }
    }

    //卸载element
    const unmount = (vnode)=>{
        hostremove(vnode.el)
    }

    //更新element
    const patchElement = (oldVNode,newVNode)=>{
        //获取el和新旧参数
        const el = (newVNode.el = oldVNode.el)
        const oldProps = oldVNode.props||EMPTY_OBJ
        const newProps = newVNode.props||EMPTY_OBJ
        //更新孩子
        patchChilren(oldVNode,newVNode,el,null)
        //更新props
        patchProps(el,newVNode,oldProps,newProps)
    }
    //============================================================
    //更新孩子
    const patchChilren = (oldVNode,newVNode,container,anchor)=>{
        const c1 = oldVNode&&oldVNode.children
        const prevShapFlag = oldVNode?oldVNode.shapeFlag:0
        const c2 = newVNode&&newVNode.children
        const { shapeFlag } = newVNode
        //开启多种情况讨论
        if(shapeFlag&ShapeFlags.TEXT_CHILDREN){
            if(prevShapFlag&ShapeFlags.ARRAY_CHILDREN){
                //新TEXT旧ARRAY
                //卸载旧子节点
            }
            if(c2 !== c1){
                //此时旧子节点为null或字符串
                //挂载新子节点文本
                hostsetElementText(container,c2)
            }
        }else{
            if(prevShapFlag&ShapeFlags.ARRAY_CHILDREN){
                if(shapeFlag&ShapeFlags.ARRAY_CHILDREN){
                    //如果新旧节点都是array
                    //diff
                    patchKeyedChildren(c1,c2,container,anchor) 
                }else{
                    //新Array旧非Array
                    //todo：卸载
                }
            }else{
            //旧节点不是array
                if(prevShapFlag&ShapeFlags.TEXT_CHILDREN){
                    //新节点不是TEXT，旧节点是Text
                    //todo：删除旧节点text
                    hostsetElementText(container,'')
                }
                if(shapeFlag&ShapeFlags.ARRAY_CHILDREN){
                    //新节点是Array，旧不是Array
                    //todo：单独新子节点挂载
                }     
            }
        }
    }

    // diff//
    const patchKeyedChildren = (oldChildren,newChildren,container,parentAnchor)=>{
        let i = 0
        const newChildrenLength = newChildren.length 
        let oldChildrenEnd = oldChildren.length-1
        let newChildrenEnd = newChildrenLength-1
        /*情况一：自前向后 */ //i++双指针前边的指针
        while(i<=oldChildrenEnd&&i<=newChildrenEnd){
            const oldVNode = oldChildren[i]
            const newVNode = normalizeVNnode(newChildren[i])
            /*比较两个孩子是不是一个*/
            if(isSameVNodeType(oldVNode,newVNode)){
                /*是一个的话说明内容分有所改变，那就改内容 */
                patch(oldVNode,newVNode,container,null)
            }else{
                //如果不一样就跳出来，就要重新挂载节点了
                break
            }
            i++
        }
        /*情况二：自后向前 */ //End--双指针后边的指针
        while(i<=oldChildrenEnd&&i<=newChildrenEnd){
            const oldVNode = oldChildren[oldChildrenEnd]
            const newVNode = normalizeVNnode(newChildren[newChildrenEnd])
            /*比较两个孩子是不是一个*/
            if(isSameVNodeType(oldVNode,newVNode)){
                /*是一个的话说明内容分有所改变，那就改内容 */
                patch(oldVNode,newVNode,container,null)
            }else{
                //如果不一样就跳出来，就要重新挂载节点了
                break
            }
            oldChildrenEnd--
            newChildrenEnd--
        }
        /*情况三：新节点多于旧节点 */ //比如 a b c => (a b c) d  或者 a b c => d (a b c) => i old new : 0 -1 0
        //这种情况限于上边两个while跑完了其他的所有节点，只剩需要新增的了，不然i不会>oldChildrenEnd
        if(i>oldChildrenEnd){
            if(i<=newChildrenEnd){
                //i<=newChildrenEnd就代表还没又整完，然后第newChildrenEnd不等，跳出了上一个while
                const nextPos = newChildrenEnd+1 //instert到它前面
                const anchor = nextPos < newChildrenLength ? newChildren[nextPos].el:parentAnchor
                while(i<=newChildrenEnd){
                    //把多出来的加上去，如果又乱序又新增，那种情况后面处理
                    patch(null,normalizeVNnode(newChildren[i]),container,anchor)
                    i++
                }
            }
        }
        /*情况四：旧节点多于新节点 */ //比如 d (a b c) => a b c 或者 (a b c) d => a b c => i old new : 3 3 2
        else if(i>newChildrenEnd){
            while(i<=oldChildrenEnd){
                unmount(oldChildren[i])
                i++
            }
        }
        /*情况五 */
        // 5. 乱序的 diff 比对
        else {
        // 旧子节点的开始索引：oldChildrenStart
        const oldStartIndex = i
        // 新子节点的开始索引：newChildrenStart
        const newStartIndex = i
        // 5.1 创建一个 <key（新节点的 key）:index（新节点的位置）> 的 Map 对象 keyToNewIndexMap。通过该对象可知：新的 child（根据 key 判断指定 child） 更新后的位置（根据对应的 index 判断）在哪里
        const keyToNewIndexMap = new Map()
        // 通过循环为 keyToNewIndexMap 填充值（s2 = newChildrenStart; e2 = newChildrenEnd）
        for (i = newStartIndex; i <= newChildrenEnd; i++) {
            // 从 newChildren 中根据开始索引获取每一个 child（c2 = newChildren）
            const nextChild = normalizeVNnode(newChildren[i])
            // child 必须存在 key（这也是为什么 v-for 必须要有 key 的原因）
            if (nextChild.key != null) {
            // 把 key 和 对应的索引，放到 keyToNewIndexMap 对象中
            keyToNewIndexMap.set(nextChild.key, i)
            }
        }

        // 5.2 循环 oldChildren ，并尝试进行 patch（打补丁）或 unmount（删除）旧节点
        let j
        // 记录已经修复的新节点数量
        let patched = 0
        // 新节点待修补的数量 = newChildrenEnd - newChildrenStart + 1
        const toBePatched = newChildrenEnd - newStartIndex + 1
        // 标记位：节点是否需要移动
        let moved = false
        // 配合 moved 进行使用，它始终保存当前最大的 index 值
        let maxNewIndexSoFar = 0
        // 创建一个 Array 的对象，用来确定最长递增子序列。它的下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-c 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
        // 但是，需要特别注意的是：oldIndex 的值应该永远 +1 （ 因为 0 代表了特殊含义，他表示《新节点没有找到对应的旧节点，此时需要新增新节点》）。即：旧节点下标为 0， 但是记录时会被记录为 1
        const newIndexToOldIndexMap = new Array(toBePatched)
        // 遍历 toBePatched ，为 newIndexToOldIndexMap 进行初始化，初始化时，所有的元素为 0
        for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
        // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），获取旧节点，如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
        for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
            // 获取旧节点
            const prevChild = oldChildren[i]
            // 如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
            if (patched >= toBePatched) {
            // 所有的节点都已经更新完成，剩余的旧节点全部删除即可
            unmount(prevChild)
            continue
            }
            // 新节点需要存在的位置，需要根据旧节点来进行寻找（包含已处理的节点。即：n-c 被认为是 1）
            let newIndex
            // 旧节点的 key 存在时
            if (prevChild.key != null) {
            // 根据旧节点的 key，从 keyToNewIndexMap 中可以获取到新节点对应的位置
            newIndex = keyToNewIndexMap.get(prevChild.key)
            } else {
            // 旧节点的 key 不存在（无 key 节点）
            // 那么我们就遍历所有的新节点，找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》，如果能找到，那么 newIndex = 该新节点索引
            for (j = newStartIndex; j <= newChildrenEnd; j++) {
                // 找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》
                if (
                newIndexToOldIndexMap[j - newStartIndex] === 0 &&
                isSameVNodeType(prevChild, newChildren[j])
                ) {
                // 如果能找到，那么 newIndex = 该新节点索引
                newIndex = j
                break
                }
            }
            }
            // 最终没有找到新节点的索引，则证明：当前旧节点没有对应的新节点
            if (newIndex === undefined) {
            // 此时，直接删除即可
            unmount(prevChild)
            }
            // 没有进入 if，则表示：当前旧节点找到了对应的新节点，那么接下来就是要判断对于该新节点而言，是要 patch（打补丁）还是 move（移动）
            else {
            // 为 newIndexToOldIndexMap 填充值：下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-c 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
            // 因为 newIndex 包含已处理的节点，所以需要减去 s2（s2 = newChildrenStart）表示：不计算已处理的节点
            newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1
            // maxNewIndexSoFar 会存储当前最大的 newIndex，它应该是一个递增的，如果没有递增，则证明有节点需要移动
            if (newIndex >= maxNewIndexSoFar) {
                // 持续递增
                maxNewIndexSoFar = newIndex
            } else {
                // 没有递增，则需要移动，moved = true
                moved = true
            }
            // 打补丁
            patch(prevChild, newChildren[newIndex], container, null)
            // 自增已处理的节点数量
            patched++
            }
        }

        // 5.3 针对移动和挂载的处理
        // 仅当节点需要移动的时候，我们才需要生成最长递增子序列，否则只需要有一个空数组即可
        const increasingNewIndexSequence = moved
            ? getSequence(newIndexToOldIndexMap)
            : []
        // j >= 0 表示：初始值为 最长递增子序列的最后下标
        // j < 0 表示：《不存在》最长递增子序列。
        j = increasingNewIndexSequence.length - 1
        // 倒序循环，以便我们可以使用最后修补的节点作为锚点
        for (i = toBePatched - 1; i >= 0; i--) {
            // nextIndex（需要更新的新节点下标） = newChildrenStart + i
            const nextIndex = newStartIndex + i
            // 根据 nextIndex 拿到要处理的 新节点
            const nextChild = newChildren[nextIndex]
            // 获取锚点（是否超过了最长长度）
            const anchor =
            nextIndex + 1 < newChildrenLength? newChildren[nextIndex+1].el: parentAnchor
            // 如果 newIndexToOldIndexMap 中保存的 value = 0，则表示：新节点没有用对应的旧节点，此时需要挂载新节点
            if (newIndexToOldIndexMap[i] === 0) {
                // 挂载新节点
                patch(null, nextChild, container, anchor)
            }
            // moved 为 true，表示需要移动
            else if (moved) {
            // j < 0 表示：不存在 最长递增子序列
            // i !== increasingNewIndexSequence[j] 表示：当前节点不在最后位置
            // 那么此时就需要 move （移动）
            if (j < 0 || i !== increasingNewIndexSequence[j]) {
                move(nextChild, container, anchor)
            } else {
                // j 随着循环递减
                j--
            }
            }
        }
        }
     }       

    /**
    * 移动节点到指定位置
    */
    const move = (vnode, container, anchor) => {
        const { el } = vnode
        hostinsert(el!, container, anchor)
        }
    



    //更新参数 
    const patchProps = (el:Element,vnode,oldProps,newProps)=>{
        if(oldProps !== newProps){
            //更新参数
            for(const key in newProps){
                const next = newProps[key]
                const prev = oldProps[key]
                if(next!==prev){
                    hostpatchProp(el,key,prev,next)
                }
            }
            //还要删除掉旧有新没有的节点
            if(oldProps!==EMPTY_OBJ){
                for(const key in oldProps){
                    if(!(key in newProps)){
                        hostpatchProp(el,key,oldProps[key],null)
                    }
                }
            }
        }
    }


    //========================================================
    //具体整体操作
    const patch = (oldVNode,newVNode,container,anchor=null)=>{
        if(oldVNode === newVNode){
            return
        }
        /*更新组件也是在这里先卸载 */
        //如果旧节点和新节点的type或key不同，就先卸载
        if(oldVNode && !isSameVNodeType(oldVNode,newVNode)){
             unmount(oldVNode)
             oldVNode = null
        }
        const {type,shapeFlag} = newVNode 
        //通过不同的类型选择不同的更新方式
        switch(type){
            case Text:
                processText(oldVNode,newVNode,container,anchor)
                break
            case Comment:
                processCommentNode(oldVNode,newVNode,container,anchor)
                break
            case Fragment:
                processFragment(oldVNode,newVNode,container,anchor)
                break
            default:
                //还有两种情况，组件和element
                if(shapeFlag&ShapeFlags.ELEMENT){
                    //处理ELEMENT
                    processElement(oldVNode,newVNode,container,anchor)
                }else if(shapeFlag&ShapeFlags.COMPONENT){
                    /*组件的处理 */
                    processComponent(oldVNode,newVNode,container,anchor)
                }else if(shapeFlag === ShapeFlags.TEXT_CHILDREN){
                    //挂载子节点用:hello{{msg}}【bug纪念碑】
                    processText(oldVNode,newVNode,container,anchor)
                }
        }
    }

    //渲染总函数
    const render = (vnode,container) => {
        if(vnode === null){
            //新节点为空，旧节点存在，删除！
            if(container.__v_isVNode){
                unmount(container.__v_isVNode)
            }
        }else{
            //更新DOM
            patch(container._vnode||null,vnode,container)
        }
        //存储一下旧节点
        container._vnode = vnode
    }

    //最后调用暴漏在runtime-dom/index中
    return{
        render,
        createApp:createAppAPI(render)
    }
}

