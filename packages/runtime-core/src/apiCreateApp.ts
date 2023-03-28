import { createVNode } from "./VNode"
//createAppAPI
export function createAppAPI(render){
    return function createApp(rootComponent,rootProps=null){
        //返回的app(vm)
        const app = {
            _component:rootComponent,
            _container:null,
            //挂载操作
            mount(rootContainer){
                const vnode = createVNode(rootComponent,rootProps,null)
                //渲染上去
                render(vnode,rootContainer)
            }

        }

        return app
    }
}