
//element操作
export const nodeOps = {
    //兼容的方法
    insert:(el:any,parent:Element,anchor?:any):void=>{
        //插入DOM
        parent.insertBefore(el,anchor||null)
    },
    createElement:(type:string):Element=>{
        //创建DOM
        const el = document.createElement(type)
        return el
    },
    setElementText:(el:Element,text:string):void=>{
        //修改DOM内容
        el.textContent = text
    },
    remove:(child)=>{
        //删除
        const parent = child.parentNode
        if(parent){
            parent.removeChild(child)
        }
    },
    createText:(text:string)=>{
        const el = document.createTextNode(text)
        return el
    },
    setText:(node,text)=>{
        node.nodeValue = text
    },
    createComment:text=>document.createComment(text)
    

}

