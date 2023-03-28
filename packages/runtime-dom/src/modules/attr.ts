//不同的属性需要不同的设置方式
//这里是需要使用setAttr设置的属性
export function patchAttr(el:Element,key:string,nextValue:string){
    if(nextValue === null){
        el.removeAttribute(key)
    }else{
        el.setAttribute(key,nextValue)
    }
}