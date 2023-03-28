import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'

/**
 * 默认导出一个数组，数组的每一个对象都是一个单独的导出文件配置，详细可查：https://www.rollupjs.com/guide/big-list-of-options
 */
//类似webpack
export default [
    {
        //配置入口文件,整个项目的入口文件
        input:'packages/vue/src/index.ts',
        //打包出口
        output:[
            //导出iife模式的包
            {
                //导出文件地址
                file:'./packages/vue/dist/vue.js',
                //生成包格式
                format:'iife',
                //变量名（就是我导入的时候一般用啥，比如Vue）
                name:'MiniVue',
                //开启soucemap
                sourcemap:true,

            }
        ],
        //插件
        plugins:[
            //ts
            typescript({
                sourceMap:true
            }),
            //模块导入的路径补全
            resolve(),
            //转commonjs为ESM
            commonjs()
        ]
    },
]