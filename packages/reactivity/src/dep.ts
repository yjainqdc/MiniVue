 import { effect, ReactiveEffect } from "./effect";

 export type Dep = Set<ReactiveEffect>

 //创建依赖们的函数，搞了一个集合装一堆依赖
 export const createDep = (effects?:ReactiveEffect[]) => {
     //传值是effect数组，Set帮忙去去重
     const dep = new Set<ReactiveEffect>(effects) as Dep
     return dep
 }