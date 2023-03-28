import { extend } from "@vue/reactivity";
import { generate } from "packages/compiler-core/src/codegen";
import { baseParse } from "packages/compiler-core/src/parse";
import { transform } from "packages/compiler-core/src/transform";
import { transformElement } from "packages/compiler-core/src/transforms/transformElement";
import { transformText } from "packages/compiler-core/src/transforms/transformText";
import { transformIf } from "packages/compiler-core/src/transforms/vif";

//compile函数的具体操作
export function baseCompile(template:string,options){
    //生成ast
    const ast = baseParse(template)
    console.log('ast',ast)
    //ast转jsast
    transform(ast,extend(options = {},{ nodeTransforms:[transformElement,transformText,transformIf] }) )
    console.log('JSast',ast)

    //生成render函数并返回
    return generate(ast)
    
}