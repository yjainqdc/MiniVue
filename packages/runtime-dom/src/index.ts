

import { extend } from "@vue/reactivity"
import { isString } from "@vue/shared"
import { createRender } from "packages/runtime-core/src/render"
import { nodeOps } from "./nodeOps"
import { patchProp } from "./patchProp"

//我要在这里导出render
//但是render是baseCreatRener的返回值，所以导出麻烦一些

const RenderOption = extend({patchProp},nodeOps)
let renderer
//在这里触发
function ensureRender(){
    return renderer||(renderer = createRender(RenderOption))
}

//对外暴漏的render
export const render = (...arg) => {
    ensureRender()
    renderer.render(...arg)
}

//对外暴漏的createApp
export const createApp = (...arg) => {
    ensureRender()
    const app = renderer.createApp(...arg)

    const {mount} = app
    //重构mount
    app.mount = (containerOrSelector:Element|string)=>{
        const container = normalizeContainer(containerOrSelector)
        if(!container){
            console.log('容器不存在')
            return null
        }
        return mount(container)
    }
    return app
}

function normalizeContainer(container:Element|string):Element|null {
    if(isString(container)){
        return document.querySelector(container)
    }else{
        return container
    }
}