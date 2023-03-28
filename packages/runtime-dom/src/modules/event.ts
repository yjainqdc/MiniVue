//事件处理
export function patchEvent(el,rawName:string,prevValue,nextValue){
    //添加个vei，作用是缓存，万一同事件，只是回调变了，就不用频繁地处理Dom监听器浪费事件
    const invokers = el._vei || (el._vei = {})
    //获取当前监听事件的回调
    const existingIncoker = invokers[rawName]
    if(nextValue&&existingIncoker){
        //都存在的话只改变回调就好了
        existingIncoker.value = nextValue
    }else{
        //不然就需要添加事件监听了
        //但是名字需要先改变onClick=》click
        const name = parseName(rawName)
        if(nextValue){
            //没有这个invoker所以需要creat一下
            const invoker = (invokers[rawName] = creatInvoker(nextValue))
            el.addEventListener(name,invoker)
        }else if(existingIncoker){
            //新的为空，旧的存在，删除事件，删除缓存
            el.removeEventListener(name,existingIncoker)
            invokers[rawName] = undefined
        }
        //invokers指向el._vei，就直接改变了（存储缓存）
    }

}

function parseName(name:string){
    return name.slice(2).toLowerCase()
}

function creatInvoker(initialValue){
    //保证了调用invoker可以执行函数
    const invoker = (e:Event) =>{
        invoker.value && invoker.value()
    }
    //把回调挂到invoker的value上
    invoker.value = initialValue
    return invoker
}