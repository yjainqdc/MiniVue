import {compile} from '@vue/compiler-dom'
import { registerRuntimeCompiler } from 'packages/runtime-core/src/component';

//让编译的render函数字符串实实在在地返回函数
function compileToFunction(template,options?){
    const {code} = compile(template,options)
    console.log(code);
    
    const render = new Function(code)()
    return render
}

//传到组件模块，给组件模块编译template用
registerRuntimeCompiler(compileToFunction)

export {compileToFunction as compile}
