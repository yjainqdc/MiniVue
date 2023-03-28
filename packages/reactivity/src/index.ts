//讲index理解为每一个模块对外暴漏的接口，然后vue统一再向外暴漏
export { reactive } from './reactive'
export { effect } from './effect'
export { ref } from './ref'
export { computed } from './computed'

//判断是否对象
export const isObject = (val:unknown) => val !== null && typeof val === 'object'

//判断值是否改变（是否相等的反）
export const hasChanged = (newValue:any,oldValue:any) => {
    return !Object.is(newValue,oldValue)
}
//判断是否为函数
export const isFuntion = (val:unknown):val is Function => {
    return typeof val === 'function'
}
//合并两个对像
 export const extend = Object.assign