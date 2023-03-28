import { isSameVNodeType } from "packages/runtime-core/src/VNode";
import { ElementTypes, NodeTypes } from "./ast";

export interface ParserContext{
    source:string
}
const enum TagType{
    //标签开始和结束
    Start,
    End
}


//生成上下文对象
function createParserContext(content:string):ParserContext{
    return{
        source:content
    }
}


//生成ast的函数
export function baseParse(content:string){
    const context = createParserContext(content)

    //触发处理函数，第二个参数看作一个ElementNode[]
    const children = parseChildren(context,[])

    return createRoot(children)
}


// 正儿八经处理的函数
function parseChildren(context:ParserContext,ancestors){
    //存储节点
    const nodes = []
    //循环解析模板
    while(!isEnd(context,ancestors)){
        const s = context.source

        let node
        if(startsWith(s,'{{')){
            //__TODO__模板语法
            node = parseInterpolation(context,ancestors)

        }else if(s[0] === '<'){
            //____标签的开始___
            if(/[a-z]/i.test(s[1])){
                //后边跟的是字母，那就是标签
                node = parseElement(context,ancestors)
            }
        }
        if(!node){
            //node为空待变上边的都没满足，既不是标签开始，也不是结束，只能是文本节点
            node = parseText(context)
        }
        pushNode(nodes,node)
    }
    return nodes
}

//__________________T__O__O__L______F_U_N_C_T_I_O_N__________________
//TOOL_IMPORTANT:解析element
function parseElement(context:ParserContext,ancestors){
    //处理开始标签
    const element = parseTag(context,TagType.Start)
    //子标签-文本,ele添加子节点
    ancestors.push(element)
    const children = parseChildren(context,ancestors)
    ancestors.pop()
    element.children = children
    //处理结束标签
    if(startsWithEndTagOpen(context.source,element.tag)){
        //这里调用parseTag的作用是为了游标右移
        parseTag(context,TagType.End)
    }
    //要插入nodes的node
    return element
}

//---------------指令逻辑也在这里开始处理--------------------------------
//TOOL_IMPORTANT_FOR_OVERTOP:解析标签tag
function parseTag(context:ParserContext,type:TagType){
    //从source中解析处标签名字
    //以尖括号 < 开始，并以一个或多个由小写字母组成的字符串为标签名，紧随其后可能会有空白字符或其他字符，最后以尖括号 > 结尾的字符串
    const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source)
    const tag = match[1] //div
    //游标右移 '<div'
    advanceBy(context,match[0].length) //看看gpt解释，很通俗（exec）

    //属性和指令的处理:
    //先将标签的属性以空格为界取出来
    advanceSpaces(context)
    let props = parseAttributes(context,type)


    //游标右移 '>'或者'/>'
    let isSelfClosing = startsWith(context.source,'/>')
    advanceBy(context,isSelfClosing?2:1)

    return {
        type:NodeTypes.ELEMENT, 
        TagType:ElementTypes.ELEMENT,
        children:[],
        props,
        tag
    }
}
//处理属性（多个）
function parseAttributes(context,type){
    const props:any = []
    //解析指令
    const attributeNames = new Set<string>()
    while(context.source.length>0 && !startsWith(context.source,'>') && !startsWith(context.source,'/>')){
        const attr = parseAttribute(context,attributeNames)
        if(type === TagType.Start){
            props.push(attr)
        }
    }
    return props
}
//处理属性（单个）
function parseAttribute(context:ParserContext,nameSet:Set<string>){
    //字符串中匹配到的第一个非空白字符、非>、/、空格、制表符、回车符、换行符、=字符的连续子串
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
    //拿到指令名
    const name = match[0]
    console.log(name)
    nameSet.add(name)
    advanceBy(context,name.length)
    let value
    //匹配以任意数量的非空白字符（包括制表符、回车符、换行符和换页符）结尾，后跟一个等于号（=）的字符串
    if(/^[^\t\r\n\f ]*=/.test(context.source)){
        advanceSpaces(context) //等号前的无用字符去掉
        advanceBy(context,1) //删除等号
        advanceSpaces(context) //等号后的无用字符去掉
        value = parseAttributeValue(context)
    }
    //判断是不是v-指令
    if(/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)){
        //获取指令名字
		const match =/(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name)!
        let dirname = match[1] //这里的指令名时v-后面的，比如if
        return{
            type:NodeTypes.DIRECTIVE,
            name:dirname,
            exp:value && {
                    type:NodeTypes.SIMPLE_EXPRESSION,
                    content:value.content,
                    isStatic:false,
                    loc:[]
            },
            art:undefined,
            modifiers:undefined,
            loc:{}
        }
    }
    //如果时普通属性
    return{
        type:NodeTypes.ATTRIBUTE,
        name,
        value:value && {
            type:NodeTypes.TEXT,
            content:value.content,
            loc:{}
        },
        loc:{}
    }
}
//处理属性的值
function parseAttributeValue(context){
    let content = ''
    const quote = context.source[0] //单引号或者双引号
    advanceBy(context,1)//删除第一个引号
    const endIndex = context.source.indexOf(quote)
    if(endIndex === -1){
        content = parseTextData(context,context.source.length)
    }else{
        content = parseTextData(context,endIndex)
        advanceBy(context,1) //再去掉最后一个引号
    }

    return{
        content,
        isQuoted:true,
        loc:[]
    }
}

//-----------------------------------------------------------------------

//游标处理，右移非固定步数:处理标签属性-删除空格等无用字符
function advanceSpaces(context:ParserContext):void{
    const match = /^[\t\r\n\f ]+/.exec(context.source)
    if(match){
        advanceBy(context,match[0].length)
    }
}

//TOOL_IMPORTANT:解析文本节点
function parseText(context:ParserContext){
    //标记一下结束白名单
    const endTokens = ['<','{{']

    let endIndex = context.source.length

    for(let i = 0;i<endTokens.length;i++){
        const index = context.source.indexOf(endTokens[i],1)
        if(index !== -1 && endIndex>index){
            //随时纠正一下普通文本的下标
            endIndex = index
        }
    }
    //拿到节点内容，也裁剪好了
    const content = parseTextData(context,endIndex) 
    return {
        type:NodeTypes.TEXT,
        content
        }
}

//TOOL_IMPORTANT_FOR_OVERTOP：解析普通文本内容(截取)
function parseTextData(context:ParserContext,length:number){
    const rawText = context.source.slice(0,length)
    advanceBy(context,length)
    return rawText
}


//TOOL：游标右移
function advanceBy(context:ParserContext,numberOfCharactoers:number){
    const { source } = context
    //切割一下解析完成的部分
    context.source = source.slice(numberOfCharactoers)
}

//TOOL
function pushNode(nodes,node){
    nodes.push(node)
}


//TOOL：是不是结束标签
function isEnd(context:ParserContext,ancestors){
    const s = context.source
    //如果以结束标签吗开头，就是结束
    if(startsWith(s,'</')){
        //理论返回true就好了，但是还有很多边缘情况
        for(let i = ancestors.length -1;i>=0;--i){
            if(startsWithEndTagOpen(s,ancestors[i].tag)){
                return true
            }
        }
    }
    return !s
}

/**TOOL：
 * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
 * @param source 模板。例如：</div>
 * @param tag 标签。例如：div
 * @returns
 */
function startsWithEndTagOpen(source:string,tag:string):boolean{
    return startsWith(source,'</')
}

//TOOL：字符串是否以**开头
function startsWith(source:string,searchString:string):boolean{
    return source.startsWith(searchString)
}

/**
 * 生成 root 节点
 */
 export function createRoot(children) {
	return {
		type: NodeTypes.ROOT,
		children,
		// loc：位置，这个属性并不影响渲染，但是它必须存在，否则会报错。所以我们给了他一个 {}
		loc: {}
	}
}

//=============================================================
//处理响应式：拿出节点，返回node
function parseInterpolation(context:ParserContext,ancestors){
    //{{ XX }} 返回插值表达式节点
    const [open,close] = ['{{','}}']
    //处理游标{{
    advanceBy(context,open.length)
    //拿到内容
    const closeIndex = context.source.indexOf(close,open.length)
    const preTrimContent = parseTextData(context,closeIndex)  //解析普通文本内容(截取)
    const content = preTrimContent.trim() //去空格
    //处理游标}}
    advanceBy(context,close.length)
    return {
        type:NodeTypes.INTERPOLATION,//插值表达式类型
        content:{
            type:NodeTypes.SIMPLE_EXPRESSION, //复合表达式类型
            IsStatic:false,
            content
        }
    }
}