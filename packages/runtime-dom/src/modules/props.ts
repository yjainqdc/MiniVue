//处理dom属性
export function patchDOMProps(el:Element,key:string,nextValue:string){
    el[key] = nextValue
}