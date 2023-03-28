
//在这里实现整个的调度队列
let  isFlusshPending = false

const resolvedPromise = Promise.resolve()

let currentFlushPromise:Promise<void> | null = null

//执行队列
const pendingPreFlushCbs:Function[] = []

//外部入口函数
export function queuePreFlushCb(cb:Function){
    queueCb(cb,pendingPreFlushCbs)
}

//推入执行队列
function queueCb(cb:Function,pendingQueue:Function[]){
    pendingQueue.push(cb)
    queueFlush()
} 

//依次执行队列中的执行函数（套一层promise变异步）
function queueFlush(){

    if(!isFlusshPending){
        isFlusshPending = true
        currentFlushPromise = resolvedPromise.then(flushJobs)
    }
}

//处理队列
function flushJobs(){
    isFlusshPending = false //执行开始了，不再等待了，就把状态改过来
    flushPreFlushCbs()
}

function flushPreFlushCbs(){
    if(pendingPreFlushCbs.length){
        //拷贝去重
        let activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
        //原数组直接置空了
        pendingPreFlushCbs.length = 0

        for (let i = 0;i<activePreFlushCbs.length;i++){
            //这么一页代码，最有用就在这里，搞了一堆，就是套了个promise，然后搞个队列执行
            activePreFlushCbs[i]()
        }
    } 
    
}