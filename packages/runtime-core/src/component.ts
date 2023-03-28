import { isFuntion, isObject, reactive } from "@vue/reactivity"
import { onBeforeMount, onMounted } from "./apiLifeCycleHook"

let uid = 0
let compile:any = null

//生命周期注册
export const enum LifecycleHooks{
    BEFORE_CREATE = 'bc',
    CREATED = 'c',
    BEFORE_MOUNT = 'bm',
    MOUNTED = 'm'

}

//创建组件实例
export function createComponentInstance(vnode){
    const type = vnode.type
    const instance={
        //组件的唯一标识
        uid:uid++,
        vnode,
        type,
        subTree:null,
        update:null,
        render:null,
        isMounted:false,
        bc:null,
        c:null,
        bm:null,
        m:null
    }
    return instance
}



//设置组件
export function setupComponent(instance){
    //有状态组件
    setupStatefulComponent(instance)
}


//-------------------------------------------------
//处理setup和组合API
function setupStatefulComponent(instance){
    const Component = instance.type 
    const{setup} = Component
    //vue2和3兼容一下
    if(setup){
        //有setup的话，按照组合api来
        //组合api里面，自带了reactive的操作
        const setupResult = setup() 
        handleSetupResult(instance,setupResult)
    }else{
        //是组合api的操作的话，那就和之前的一样了
        //tips：其实还没有写什么计算属性和监视属性
        finishComponentSetup(instance)
    }
}
//处理setup
function handleSetupResult(instance,setupResult){
    if(isFuntion(setupResult)){
        instance.render = setupResult
    }
}
//tips:计算属性，监视属性自己走自己逻辑就好了，reactive自己包裹，不用vue2那么麻烦了
//---------------------------------------------------


export function finishComponentSetup(instance){
    //主要是给render函数赋值
    //此时这个type就是定义Component建立的对象
    const Component = instance.type

    //setup中没有赋值，才赋值第二遍
    //最后增加了一个给render赋值，是利用template赋值
    if(!instance.render){
        //如果还没生成render
        if(compile && !Component.render){
            const template = Component.template
            Component.render = compile(template)
        }
        instance.render = Component.render
    }

    //处理option的API，比如data、computed等等
    applyOpthins(instance)
}
//--------------------------------------------------------------
//更改公共变量，用于利用template生成render
export function registerRuntimeCompiler(_compile:any){
    compile = _compile
}
//--------------------------------------------------------------


function applyOpthins(instance:any){
    const { 
        data:dataOpthons,
        beforeCreate,
        created,
        beforeMount,
        mounted
    } = instance.type

    /*数据初始化之前时beforeCreated */
    //此时data还没有挂到instance（vc）上
    if(beforeCreate){
        callHook(beforeCreate,instance.data)
    }

    //拿到data，然后搞一层reactive，再赋值给instance
    if(dataOpthons){
        const data = dataOpthons()
        if(isObject(data)){
            //此处可以注意，componet的挂载封装成了effect，这样可以为它们添加依赖了
            instance.data = reactive(data)
        }
    }

    /*数据初始化之后时created */
    //此时data刚刚挂到instance（vc）上
    if(created){
        callHook(created,instance.data)
    }

    //生命周期注册函数
    function registerLifecycleHooks(register:Function,hook?:Function){
        //把生命周期的回调整到instance上
        register(hook?.bind(instance.data),instance)
    }

    /*注册其他生命周期 */
    //在render触发
    registerLifecycleHooks(onBeforeMount,beforeMount)
    registerLifecycleHooks(onMounted,mounted)
    console.log(instance)
}

function callHook(hook:Function,proxy){
    hook.bind(proxy)()
}
