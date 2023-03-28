import { isString } from "@vue/shared"


//为了简化，没有写缓存
export function patchStyle(el:Element,prevValue,nextValue){
    //获取旧style并判断新style是否是新string
    const style = (el as HTMLElement).style
    const isCssString =  isString(nextValue)

    if(nextValue && !isCssString){
        //新样式挂载
        for(const key in nextValue){
            //遍历每一个Style的属性，再设置
            setStyle(style,key,nextValue[key])
        }
        //旧样式清理
        if(prevValue && !isCssString){
            for(const key in prevValue){
                if(!(key in nextValue)){
                    setStyle(style,key,'')
                }
            }
        }
    }
}



//设置单个属性
function setStyle(style:CSSStyleDeclaration,name:string,val:string|string[]){
    style[name] = val
}