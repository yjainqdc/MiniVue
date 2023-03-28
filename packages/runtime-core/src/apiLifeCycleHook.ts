import { LifecycleHooks } from "./component";

//target时instance组件的实例，这个函数把回调赋值到target
export function injectHook(type:LifecycleHooks,hook:Function,target){
    if(target){
        target[type] = hook
    }
}

export const createHook = (lifecycle:LifecycleHooks) =>{
    return (hook,target)=>injectHook(lifecycle,hook,target)
}

//返回注册函数
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)

//返回注册函数
export const onMounted = createHook(LifecycleHooks.MOUNTED)