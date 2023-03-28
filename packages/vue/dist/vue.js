var MiniVue = (function (exports) {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    //创建依赖们的函数，搞了一个集合装一堆依赖
    var createDep = function (effects) {
        //传值是effect数组，Set帮忙去去重
        var dep = new Set(effects);
        return dep;
    };

    var targetMap = new WeakMap();
    //========================================================================================================
    //依赖的具体操作
    //========================================================================================================
    //1.收集依赖
    function track(target, key) {
        //如果没有被执行的，那就不用track了，也没啥要收集的，因为收集都是在effect第一次执行的时候（触发了get，才到了这里）
        if (!activeEffect)
            return;
        var depsMap = targetMap.get(target);
        //之前没有添加依赖过的话，现在就先新建个键值对
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        //再查看查看有没有维护dep集合
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        //再给具体的key绑定依赖
        // depsMap.set(key,activeEffect)
        trackEffects(dep);
    }
    //1.1利用dep依次跟踪key的所有effect(帮助实现一对多)
    function trackEffects(dep) {
        dep.add(activeEffect);
    }
    //2.触发依赖
    function trigger(target, key, value) {
        //获取当前对象的依赖
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            return;
        }
        //获取当前对象的当前属性的依赖
        var effects = depsMap.get(key);
        if (!effect)
            return;
        //依次触发依赖
        // effect.fn() 
        triggerEffects(effects);
    }
    // 2.1利用dep依次触发key的所有effect(帮助实现一对多)
    function triggerEffects(dep) {
        var effects = Array.isArray(dep) ? dep : __spreadArray([], __read(dep), false);
        effects.forEach(function (item) {
            //如果computed中有调度器，我们需要执行调度器，有调度器地effect都是计算属性的计算逻辑
            //为了防止一个计算属性再effect中出现吗两次，容易产生死循环，故先执行完计算逻辑再执行其他effect
            if (item.scheduler) {
                item.scheduler();
            }
        });
        effects.forEach(function (item) {
            if (!item.computed) {
                item.run();
            }
        });
    }
    //========================================================================================================
    //对外暴漏的effectAPI，依赖
    //========================================================================================================
    //effect 会立即执行传入的函数，并在函数的依赖发生变化时重新运行该函数(依赖函数)
    function effect(fn, options) {
        //构建ReactiveEffect实例
        var _effect = new ReactiveEffect(fn);
        //合并两个对象，好让effect里面有scheduler
        if (options) {
            extend(_effect, options);
        }
        //非懒执行
        if (!options || !options.lazy) {
            _effect.run();
        }
    }
    //一个公共标记，保存当前被执行的effect
    var activeEffect;
    //这个类方便存依赖
    var ReactiveEffect = /** @class */ (function () {
        function ReactiveEffect(fn, scheduler) {
            if (scheduler === void 0) { scheduler = null; }
            this.fn = fn;
            this.scheduler = scheduler;
        }
        ReactiveEffect.prototype.run = function () {
            //标记当前被执行的effect
            activeEffect = this;
            return this.fn();
        };
        ReactiveEffect.prototype.stop = function () { };
        return ReactiveEffect;
    }());
    //========================================================================================================

    var get = createGetter();
    var set = createSetter();
    //getter
    function createGetter() {
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver);
            //依赖收集，在effect.ts
            track(target, key);
            return res;
        };
    }
    //setter
    function createSetter() {
        return function get(target, key, value, receiver) {
            var res = Reflect.set(target, key, value, receiver); // 得到了布尔值
            //触发依赖，在effect.ts
            trigger(target, key);
            return res;
        };
    }
    //监视操作
    var mutableHandlers = {
        get: get,
        set: set
    };

    var reactiveMap = new WeakMap();
    //对外暴漏的reactiveAPI
    //========================================================================================================
    function reactive(target) {
        return createReactiveObject(target, mutableHandlers, reactiveMap);
    }
    //创建代理对象的函数
    function createReactiveObject(target, baseHandlers, //proxy接口ProxyHandler
    proxyMap) {
        //缓存机制
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy; //如果已经有了，那就直接返回就好了
        }
        //如果没有就创建
        var proxy = new Proxy(target, baseHandlers);
        proxy.__v_isReactive = true;
        //然后维护一下缓存
        proxyMap.set(target, proxy);
        return proxy;
    }
    //========================================================================================================
    // ref中的toReactive
    //========================================================================================================
    //泛型，返回值为T
    var toReactive = function (value) {
        //isObject定义再index
        return isObject(value) ? reactive(value) : value;
    };
    //========================================================================================================
    //判断是否是reactive
    function isReactive(val) {
        return !!(val && val.__v_isReactive);
    }

    function ref(value) {
        //shaow设置为false，都会取走toreactive中isObject的校验
        return createRef(value, false);
    }
    function createRef(rawValue, shallow) {
        //首先判断，如果是ref的数据，直接返回就行了
        if (isRef(rawValue)) {
            return rawValue;
        }
        //新建一个和ref专属类别
        return new refImpl(rawValue, shallow);
    }
    //判断是否为refimpl类型
    // r is Ref,Ref是接口
    function isRef(r) {
        //双感叹号强转成布尔值,首先判断了是否为Ref型数据
        return !!(r && r.__v_isRef);
    }
    var refImpl = /** @class */ (function () {
        function refImpl(value, __v_isShallow) {
            this.__v_isShallow = __v_isShallow;
            //dep是Dep，默认是undefined
            this.dep = undefined;
            this.__v_isRef = true;
            this._rawValue = value;
            //如果不是普通数据类型，ref的value就转成reactive包裹一下
            this._value = this.__v_isShallow ? value : toReactive(value);
        }
        Object.defineProperty(refImpl.prototype, "value", {
            //用get和set修饰，顾名思义，就会再获取 obj.value 执行get，在修改执行set
            //本质上ref使用的是get和set的主动触发value函数
            //***********get value ***********/
            get: function () {
                //添加ref类型的依赖
                trackRefVal(this);
                return this._value;
            },
            //***********set value ***********/
            set: function (newValue) {
                if (hasChanged(newValue, this._rawValue)) {
                    //如果发生了改变
                    this._rawValue = newValue;
                    this._value = toReactive(newValue);
                    //toReactive中会判断是不是对象的，如果不是就返回value
                    triggerRefVal(this);
                }
            },
            enumerable: false,
            configurable: true
        });
        return refImpl;
    }());
    //============================================================
    // 收集依赖
    function trackRefVal(ref) {
        //activeEffect是个公共的标记，判断当前的activeEffect是否存在
        //流程：effec中创教你新的ReactiveEffect实例=>构造函数时，令activeEffec=this=>effect.run=>触发get
        if (activeEffect) {
            //没有依赖就创建依赖
            //trackEffectsn帮忙实现添加依赖
            trackEffects(ref.dep || (ref.dep = createDep()));
        }
    }
    //============================================================
    //触发依赖
    function triggerRefVal(ref) {
        if (ref.dep)
            triggerEffects(ref.dep);
    }

    //computed宗旨：别人get我，同ref一样，set时，不仅监听我自己，还得监听我内部用到的
    //ComputedRefImpl
    //===========================================================================================
    var ComputedRefImpl = /** @class */ (function () {
        //构造时配置好effect
        //此effect非彼effect，这里是把computed中的计算方式当作effect
        function ComputedRefImpl(getter) {
            var _this = this;
            //依赖
            this.dep = undefined;
            this.__v_isRef = true;
            //脏属性,值为true表示需要执行run方法,默认为true，肯定先执行一次
            this._dirty = true;
            //新建一个ReactiveEffect函数
            //需要去给ReactiveEffect类中添加这个属性
            this.effect = new ReactiveEffect(getter, function () {
                if (!_this._dirty) {
                    _this._dirty = true;
                    triggerRefVal(_this);
                }
            });
            this.effect.computed = this;
        }
        Object.defineProperty(ComputedRefImpl.prototype, "value", {
            //get
            get: function () {
                //利用Ref的track实现
                trackRefVal(this);
                //计算属性传入为一个函数，返回值为其值，get一次计算一次
                //当脏状态为真时，执行一次计算逻辑（this.effect）
                if (this._dirty) {
                    this._dirty = false;
                    //！！！！重点注释
                    //1.此时effect为计算逻辑，会用到其他的响应式变量
                    //2.当我这个run起来之后，会触发其他响应式变量的get
                    //3.触发get就会触发track把activeEffect add进他们targetMap或refImpl的dep中
                    //4.此时activateEffect为计算逻辑，因为我effect.run()了
                    //总结：把计算属性里的计算逻辑看作effect，很顺利的给每一个属性加了dep
                    this._value = this.effect.run();
                }
                return this._value;
            },
            set: function (newValue) {
            },
            enumerable: false,
            configurable: true
        });
        return ComputedRefImpl;
    }());
    //===========================================================================================
    //computed
    //===========================================================================================
    function computed(getterOrOptions) {
        var getter;
        //判断传进来的是配置项还是函数 
        var onlyGetter = isFuntion(getterOrOptions);
        if (onlyGetter) {
            getter = getterOrOptions;
        }
        //创建类实例
        var cRef = new ComputedRefImpl(getter);
        return cRef;
    }
    //===========================================================================================

    //讲index理解为每一个模块对外暴漏的接口，然后vue统一再向外暴漏
    //判断是否对象
    var isObject = function (val) { return val !== null && typeof val === 'object'; };
    //判断值是否改变（是否相等的反）
    var hasChanged = function (newValue, oldValue) {
        return !Object.is(newValue, oldValue);
    };
    //判断是否为函数
    var isFuntion = function (val) {
        return typeof val === 'function';
    };
    //合并两个对像
    var extend = Object.assign;

    var toDisplayString = function (val) {
        return String(val);
    };

    //公共用
    //空对象
    var EMPTY_OBJ = {};
    //判断字符串
    function isString(val) {
        return typeof val === 'string';
    }
    //判断是否以on开头,正则
    var onRE = /^on[^a-z]/;
    var isOn = function (key) { return onRE.test(key); };
    //获取最长字串--动态规划
    /**
     * 获取最长递增子序列下标
     * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
     * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
     */
    /**
     * 获取最长递增子序列下标
     * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
     * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
     */
    function getSequence(arr) {
        // 获取一个数组浅拷贝。注意 p 的元素改变并不会影响 arr
        // p 是一个最终的回溯数组，它会在最终的 result 回溯中被使用
        // 它会在每次 result 发生变化时，记录 result 更新前最后一个索引的值
        var p = arr.slice();
        // 定义返回值（最长递增子序列下标），因为下标从 0 开始，所以它的初始值为 0
        var result = [0];
        var i, j, u, v, c;
        // 当前数组的长度
        var len = arr.length;
        // 对数组中所有的元素进行 for 循环处理，i = 下标
        for (i = 0; i < len; i++) {
            // 根据下标获取当前对应元素
            var arrI = arr[i];
            //
            if (arrI !== 0) {
                // 获取 result 中的最后一个元素，即：当前 result 中保存的最大值的下标
                j = result[result.length - 1];
                // arr[j] = 当前 result 中所保存的最大值
                // arrI = 当前值
                // 如果 arr[j] < arrI 。那么就证明，当前存在更大的序列，那么该下标就需要被放入到 result 的最后位置
                if (arr[j] < arrI) {
                    p[i] = j;
                    // 把当前的下标 i 放入到 result 的最后位置
                    result.push(i);
                    continue;
                }
                // 不满足 arr[j] < arrI 的条件，就证明目前 result 中的最后位置保存着更大的数值的下标。
                // 但是这个下标并不一定是一个递增的序列，比如： [1, 3] 和 [1, 2]
                // 所以我们还需要确定当前的序列是递增的。
                // 计算方式就是通过：二分查找来进行的
                // 初始下标
                u = 0;
                // 最终下标
                v = result.length - 1;
                // 只有初始下标 < 最终下标时才需要计算
                while (u < v) {
                    // (u + v) 转化为 32 位 2 进制，右移 1 位 === 取中间位置（向下取整）例如：8 >> 1 = 4;  9 >> 1 = 4; 5 >> 1 = 2
                    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Right_shift
                    // c 表示中间位。即：初始下标 + 最终下标 / 2 （向下取整）
                    c = (u + v) >> 1;
                    // 从 result 中根据 c（中间位），取出中间位的下标。
                    // 然后利用中间位的下标，从 arr 中取出对应的值。
                    // 即：arr[result[c]] = result 中间位的值
                    // 如果：result 中间位的值 < arrI，则 u（初始下标）= 中间位 + 1。即：从中间向右移动一位，作为初始下标。 （下次直接从中间开始，往后计算即可）
                    if (arr[result[c]] < arrI) {
                        u = c + 1;
                    }
                    else {
                        // 否则，则 v（最终下标） = 中间位。即：下次直接从 0 开始，计算到中间位置 即可。
                        v = c;
                    }
                }
                // 最终，经过 while 的二分运算可以计算出：目标下标位 u
                // 利用 u 从 result 中获取下标，然后拿到 arr 中对应的值：arr[result[u]]
                // 如果：arr[result[u]] > arrI 的，则证明当前  result 中存在的下标 《不是》 递增序列，则需要进行替换
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1];
                    }
                    // 进行替换，替换为递增序列
                    result[u] = i;
                }
            }
        }
        // 重新定义 u。此时：u = result 的长度
        u = result.length;
        // 重新定义 v。此时 v = result 的最后一个元素
        v = result[u - 1];
        // 自后向前处理 result，利用 p 中所保存的索引值，进行最后的一次回溯
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }

    //在这里实现整个的调度队列
    var isFlusshPending = false;
    var resolvedPromise = Promise.resolve();
    //执行队列
    var pendingPreFlushCbs = [];
    //外部入口函数
    function queuePreFlushCb(cb) {
        queueCb(cb, pendingPreFlushCbs);
    }
    //推入执行队列
    function queueCb(cb, pendingQueue) {
        pendingQueue.push(cb);
        queueFlush();
    }
    //依次执行队列中的执行函数（套一层promise变异步）
    function queueFlush() {
        if (!isFlusshPending) {
            isFlusshPending = true;
            resolvedPromise.then(flushJobs);
        }
    }
    //处理队列
    function flushJobs() {
        isFlusshPending = false; //执行开始了，不再等待了，就把状态改过来
        flushPreFlushCbs();
    }
    function flushPreFlushCbs() {
        if (pendingPreFlushCbs.length) {
            //拷贝去重
            var activePreFlushCbs = __spreadArray([], __read(new Set(pendingPreFlushCbs)), false);
            //原数组直接置空了
            pendingPreFlushCbs.length = 0;
            for (var i = 0; i < activePreFlushCbs.length; i++) {
                //这么一页代码，最有用就在这里，搞了一堆，就是套了个promise，然后搞个队列执行
                activePreFlushCbs[i]();
            }
        }
    }

    //外部入口函数
    function watch(source, cb, options) {
        return doWatch(source, cb, options);
    }
    //watch在这里实现
    function doWatch(source, cb, _a) {
        var _b = _a === void 0 ? EMPTY_OBJ : _a, immediate = _b.immediate, deep = _b.deep;
        var getter;
        //source是监听的源
        if (isReactive(source)) {
            getter = function () { return source; };
            //如果是reactive类型，肯定自动deep
            deep = true;
        }
        else {
            getter = function () { };
        }
        //======在此进行依赖收集=======//
        if (cb && deep) {
            //本质：遍历所有source，完成依赖触发
            var baseGetter_1 = getter;
            //等同于传进去了source 
            getter = function () { return traverse(baseGetter_1()); };
        }
        //======在此存储oldvalue值=======//
        var oldValue = {};
        //======这里就是包装好的cb=======//
        //job每次执行相当于cb执行一次
        var job = function () {
            if (cb) {
                var newValue = effect.run();
                if (deep || hasChanged(newValue, oldValue)) {
                    cb(newValue, oldValue);
                    //新值变旧值存起来
                    oldValue = newValue;
                }
            }
        };
        //======在此定义调度器，变为异步=======//
        //作用就在这里，把这些job变为异步的
        var scheduler = function () { return queuePreFlushCb(job); };
        //======在此定义effect，借助scheduler实现监视回调=======//
        var effect = new ReactiveEffect(getter, scheduler);
        //======在此执行effect.run，绑定上activeEffect，当然回调啥时候执行另说=======//
        if (cb) {
            if (immediate) {
                //立刻触发回调
                job();
            }
            else {
                //不然就拿到旧值就行了，本质这个run的fn就是上面的getter
                //此处直接新值变旧值
                oldValue = effect.run();
            }
        }
        else {
            //没有回调的话直接就run，作用是activeEffect为此
            effect.run();
        }
        return function () {
            effect.stop();
        };
    }
    function traverse(value) {
        if (!isObject(value)) {
            return value;
        }
        //如果是对象，就递归去遍历一下
        for (var key in value) {
            //递归地去触发get
            traverse(value[key]);
        }
        return value;
    }

    /**
     * 规范化 class 类，处理 class 的增强
     */
    function normalizeClass(value) {
        var res = '';
        // 判断是否为 string，如果是 string 就不需要专门处理
        if (isString(value)) {
            res = value;
        }
        // 额外的数组增强。官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-to-arrays
        else if (Array.isArray(value)) {
            // 循环得到数组中的每个元素，通过 normalizeClass 方法进行迭代处理
            for (var i = 0; i < value.length; i++) {
                var normalized = normalizeClass(value[i]);
                if (normalized) {
                    res += normalized + ' ';
                }
            }
        }
        // 额外的对象增强。官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-html-classes
        else if (isObject(value)) {
            // for in 获取到所有的 key，这里的 key（name） 即为 类名。value 为 boolean 值
            for (var name_1 in value) {
                // 把 value 当做 boolean 来看，拼接 name
                if (value[name_1]) {
                    res += name_1 + ' ';
                }
            }
        }
        // 去左右空格
        return res.trim();
    }

    //三个内置的type格式
    //其中Text正常字符串，Comment为注释，Fragment为片段,当然这是渲染的时候再做改变
    var Fragment = Symbol('Fragment');
    var Text$1 = Symbol('Text');
    var Comment = Symbol('Comment');
    //判断是不是VNode
    function isVNode(val) {
        return val ? val.__v_isVNode : false;
    }
    //判断是不是同一个VNode
    function isSameVNodeType(n1, n2) {
        return n1.type === n2.type && n1.key === n2.key;
    }
    function createVNode(type, props, children) {
        //一连串三元表达式判断是什么类型
        var shapeFlag = isString(type) ? 1 /* ShapeFlags.ELEMENT */
            : isObject(type) ? 4 /* ShapeFlags.STATEFUL_COMPONENT */ : 0;
        if (props) {
            // 处理 class
            var klass = props.class; props.style;
            if (klass && !isString(klass)) {
                props.class = normalizeClass(klass);
            }
        }
        return creatBaseVNode(type, props, children, shapeFlag);
    }
    //创建VNode对象
    function creatBaseVNode(type, props, children, shapeFlag) {
        var vnode = {
            __v_isVNode: true,
            type: type,
            props: props,
            shapeFlag: shapeFlag,
            key: (props === null || props === void 0 ? void 0 : props.key) || null
        };
        //解析children，然后给父vnode搞完善
        normalizeChileren(vnode, children);
        return vnode;
    }
    //将children标准化搞成Vnode的函数
    function normalizeChileren(vnode, children) {
        //根据状态解析
        var type = 0;
        vnode.shapeFlag;
        if (children == null) ;
        else if (Array.isArray(children)) {
            //2.如果children是 Array
            type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
        }
        else if (isObject(children)) ;
        else if (isFuntion(children)) ;
        else {
            //5.如果children是 字符串
            //转一下,现在有了children的type
            children = String(children);
            type = 8 /* ShapeFlags.TEXT_CHILDREN */;
        }
        vnode.children = children;
        vnode.shapeFlag |= type;
    }
    function createCommentVNode(text) {
        return createVNode(Comment, null, text);
    }

    //在这里主要对参数进行了一个处理
    function h(type, propsOrChildren, children) {
        //首先获取参数长度
        var l = arguments.length;
        //如果参数长度为2
        if (l == 2) {
            if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) {
                if (isVNode(propsOrChildren)) {
                    //1.如果第二个参数是对象且为VNode，当成children来用
                    return createVNode(type, null, [propsOrChildren]);
                }
                //2.如果第二个参数是对象，不为VNode，当成props来用
                return createVNode(type, propsOrChildren);
            }
            else {
                //3.如果第二个参数是数组或字符串，当成children数组来用
                return createVNode(type, null, propsOrChildren);
            }
        }
        else {
            //如果参数长度大于3
            if (l > 3) {
                //此情况为一个一个传进来的children
                children = Array.prototype.slice.call(arguments, 2);
            }
            else if (l === 3 && isVNode(children)) {
                children = [children];
            }
            return createVNode(type, propsOrChildren, children);
        }
    }

    //createAppAPI
    function createAppAPI(render) {
        return function createApp(rootComponent, rootProps) {
            if (rootProps === void 0) { rootProps = null; }
            //返回的app(vm)
            var app = {
                _component: rootComponent,
                _container: null,
                //挂载操作
                mount: function (rootContainer) {
                    var vnode = createVNode(rootComponent, rootProps, null);
                    //渲染上去
                    render(vnode, rootContainer);
                }
            };
            return app;
        };
    }

    function normalizeVNnode(child) {
        if (typeof child === 'object') {
            return child;
        }
        else {
            return createVNode(Text, null, String(child));
        }
    }
    //组件相关，创建subTree
    function renderComponentRoot(instance) {
        var vnode = instance.vnode, render = instance.render, data = instance.data;
        var result;
        try {
            if (vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
                //定义的时候传进去的render属性是一个函数，返回值为vnode
                //里面的data都是使用this传在render的，所以需要用call改变this指向
                //其中传两个参数的原因是利用模板生成的render函数需要一个_cts参数，也是变this指向
                result = normalizeVNnode(render.call(data, data));
            }
        }
        catch (error) {
            console.log(error);
        }
        return result;
    }

    //target时instance组件的实例，这个函数把回调赋值到target
    function injectHook(type, hook, target) {
        if (target) {
            target[type] = hook;
        }
    }
    var createHook = function (lifecycle) {
        return function (hook, target) { return injectHook(lifecycle, hook, target); };
    };
    //返回注册函数
    var onBeforeMount = createHook("bm" /* LifecycleHooks.BEFORE_MOUNT */);
    //返回注册函数
    var onMounted = createHook("m" /* LifecycleHooks.MOUNTED */);

    var uid = 0;
    var compile$1 = null;
    //创建组件实例
    function createComponentInstance(vnode) {
        var type = vnode.type;
        var instance = {
            //组件的唯一标识
            uid: uid++,
            vnode: vnode,
            type: type,
            subTree: null,
            update: null,
            render: null,
            isMounted: false,
            bc: null,
            c: null,
            bm: null,
            m: null
        };
        return instance;
    }
    //设置组件
    function setupComponent(instance) {
        //有状态组件
        setupStatefulComponent(instance);
    }
    //-------------------------------------------------
    //处理setup和组合API
    function setupStatefulComponent(instance) {
        var Component = instance.type;
        var setup = Component.setup;
        //vue2和3兼容一下
        if (setup) {
            //有setup的话，按照组合api来
            //组合api里面，自带了reactive的操作
            var setupResult = setup();
            handleSetupResult(instance, setupResult);
        }
        else {
            //是组合api的操作的话，那就和之前的一样了
            //tips：其实还没有写什么计算属性和监视属性
            finishComponentSetup(instance);
        }
    }
    //处理setup
    function handleSetupResult(instance, setupResult) {
        if (isFuntion(setupResult)) {
            instance.render = setupResult;
        }
    }
    //tips:计算属性，监视属性自己走自己逻辑就好了，reactive自己包裹，不用vue2那么麻烦了
    //---------------------------------------------------
    function finishComponentSetup(instance) {
        //主要是给render函数赋值
        //此时这个type就是定义Component建立的对象
        var Component = instance.type;
        //setup中没有赋值，才赋值第二遍
        //最后增加了一个给render赋值，是利用template赋值
        if (!instance.render) {
            //如果还没生成render
            if (compile$1 && !Component.render) {
                var template = Component.template;
                Component.render = compile$1(template);
            }
            instance.render = Component.render;
        }
        //处理option的API，比如data、computed等等
        applyOpthins(instance);
    }
    //--------------------------------------------------------------
    //更改公共变量，用于利用template生成render
    function registerRuntimeCompiler(_compile) {
        compile$1 = _compile;
    }
    //--------------------------------------------------------------
    function applyOpthins(instance) {
        var _a = instance.type, dataOpthons = _a.data, beforeCreate = _a.beforeCreate, created = _a.created, beforeMount = _a.beforeMount, mounted = _a.mounted;
        /*数据初始化之前时beforeCreated */
        //此时data还没有挂到instance（vc）上
        if (beforeCreate) {
            callHook(beforeCreate, instance.data);
        }
        //拿到data，然后搞一层reactive，再赋值给instance
        if (dataOpthons) {
            var data = dataOpthons();
            if (isObject(data)) {
                //此处可以注意，componet的挂载封装成了effect，这样可以为它们添加依赖了
                instance.data = reactive(data);
            }
        }
        /*数据初始化之后时created */
        //此时data刚刚挂到instance（vc）上
        if (created) {
            callHook(created, instance.data);
        }
        //生命周期注册函数
        function registerLifecycleHooks(register, hook) {
            //把生命周期的回调整到instance上
            register(hook === null || hook === void 0 ? void 0 : hook.bind(instance.data), instance);
        }
        /*注册其他生命周期 */
        //在render触发
        registerLifecycleHooks(onBeforeMount, beforeMount);
        registerLifecycleHooks(onMounted, mounted);
        console.log(instance);
    }
    function callHook(hook, proxy) {
        hook.bind(proxy)();
    }

    //入口
    function createRender(options) {
        return baseCreatRenderer(options);
    }
    //巨无霸函数
    function baseCreatRenderer(options) {
        //接收一下通用方法,改个名
        var hostinsert = options.insert, hostcreateElement = options.createElement, hostsetElementText = options.setElementText, hostpatchProp = options.patchProp, hostremove = options.remove, hostcreateText = options.createText, hostsetText = options.setText, hostcreateComment = options.createComment;
        /*组件的处理*/
        var processComponent = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode === null) {
                mountCompomemt(newVNode, container, anchor);
            }
        };
        //处理ELEMENT的函数
        var processElement = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode == null) {
                //如果old是空，则执行挂载操作
                mountElement(newVNode, container, anchor);
            }
            else {
                //更新element
                patchElement(oldVNode, newVNode);
            }
        };
        //处理TEXT
        var processText = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode == null) {
                //挂载
                newVNode.el = hostcreateText(newVNode.children);
                hostinsert(newVNode.el, container, anchor);
            }
            else {
                //更新
                var el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) {
                    hostsetText(el, newVNode.children);
                }
            }
        };
        //处理comment
        var processCommentNode = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode == null) {
                newVNode.el = hostcreateComment(newVNode.children);
                hostinsert(newVNode.el, container, anchor);
            }
            else {
                newVNode.el = oldVNode.el;
            }
        };
        //处理Fragment:本质是只挂载孩子
        var processFragment = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                mountChildren(newVNode.children, container, anchor);
            }
            else {
                patchChilren(oldVNode, newVNode, container, anchor);
            }
        };
        //----------------------------------------------------------------------
        /*挂载组件 */
        var mountCompomemt = function (initialVNode, container, anchor) {
            /*创建一个组件专用实例，component.ts中*/
            /*给vnode绑定component */
            initialVNode.component = createComponentInstance(initialVNode);
            var instance = initialVNode.component;
            /*主要给instance.render赋值 */
            setupComponent(instance);
            /*真正处理渲染组件 */
            setupRenderEffect(instance, initialVNode, container, anchor);
        };
        /*真正挂载渲染组件的函数，直接写在这里了方便看 */
        var setupRenderEffect = function (instance, initialVNode, container, anchor) {
            var bm = instance.bm, m = instance.m;
            /*这里挂载和更新subtree */
            var componentUpdateFn = function () {
                if (!instance.isMounted) {
                    //生命周期beforemount
                    if (bm) {
                        bm();
                    }
                    /*没有挂载过的话就创建一个subTree,其中是组件属性render的返回值 */
                    var subTree = (instance.subTree = renderComponentRoot(instance));
                    /*挂,subTree现在是vnode */
                    patch(null, subTree, container, anchor);
                    //搞这个是为了一会更新的时候方便unmount
                    initialVNode.el = subTree.el;
                    instance.isMounted = true;
                    //生命周期mounted
                    if (m) {
                        m();
                    }
                }
                else {
                    //组件没有变化，更新组件内的数据，也就是set操作
                    var next = instance.next, vnode = instance.vnode;
                    if (!next) {
                        next = vnode;
                    }
                    /*vnode是之前的，next是现在的 */
                    /*旧树和新树替换 */
                    var nextTree = renderComponentRoot(instance);
                    var prevTree = instance.subTree;
                    instance.subTree = nextTree;
                    //打补丁
                    patch(prevTree, nextTree, container, anchor);
                    //方便unmount
                    next.el = nextTree.el;
                }
            };
            /*搞一个effect，scheduler传入的是被promise包裹了一下的函数 */
            var effect = (instance.effect = new ReactiveEffect(componentUpdateFn, function () { return queuePreFlushCb(update); }));
            /*先run一下，负责渲染 */
            var update = (instance.update = function () { effect.run(); });
            update();
        };
        //------------------------------------------------------------------------------
        //挂载element
        var mountElement = function (vnode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            var type = vnode.type, shapeFlag = vnode.shapeFlag, props = vnode.props;
            //1.创建element
            var el = (vnode.el = hostcreateElement(type));
            //2.设置文本
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                //先确定得是text的子节点
                hostsetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                //数组孩子处理，循环挂载，先挂到vnode生成的el上
                mountChildren(vnode.children, el, anchor);
            }
            //3.设置props
            if (props) {
                for (var key in props) {
                    hostpatchProp(el, key, null, props[key]);
                }
            }
            //4.插入 
            hostinsert(el, container, anchor);
        };
        //挂载孩子
        var mountChildren = function (children, container, anchor) {
            for (var i = 0; i < children.length; i++) {
                var child = (children[i] = normalizeVNnode(children[i]));
                // patchChilren(null,child,container,anchor)
                patch(null, child, container, anchor);
            }
        };
        //卸载element
        var unmount = function (vnode) {
            hostremove(vnode.el);
        };
        //更新element
        var patchElement = function (oldVNode, newVNode) {
            //获取el和新旧参数
            var el = (newVNode.el = oldVNode.el);
            var oldProps = oldVNode.props || EMPTY_OBJ;
            var newProps = newVNode.props || EMPTY_OBJ;
            //更新孩子
            patchChilren(oldVNode, newVNode, el, null);
            //更新props
            patchProps(el, newVNode, oldProps, newProps);
        };
        //============================================================
        //更新孩子
        var patchChilren = function (oldVNode, newVNode, container, anchor) {
            var c1 = oldVNode && oldVNode.children;
            var prevShapFlag = oldVNode ? oldVNode.shapeFlag : 0;
            var c2 = newVNode && newVNode.children;
            var shapeFlag = newVNode.shapeFlag;
            //开启多种情况讨论
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                if (c2 !== c1) {
                    //此时旧子节点为null或字符串
                    //挂载新子节点文本
                    hostsetElementText(container, c2);
                }
            }
            else {
                if (prevShapFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                    if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                        //如果新旧节点都是array
                        //diff
                        patchKeyedChildren(c1, c2, container, anchor);
                    }
                }
                else {
                    //旧节点不是array
                    if (prevShapFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                        //新节点不是TEXT，旧节点是Text
                        //todo：删除旧节点text
                        hostsetElementText(container, '');
                    }
                }
            }
        };
        // diff//
        var patchKeyedChildren = function (oldChildren, newChildren, container, parentAnchor) {
            var i = 0;
            var newChildrenLength = newChildren.length;
            var oldChildrenEnd = oldChildren.length - 1;
            var newChildrenEnd = newChildrenLength - 1;
            /*情况一：自前向后 */ //i++双指针前边的指针
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[i];
                var newVNode = normalizeVNnode(newChildren[i]);
                /*比较两个孩子是不是一个*/
                if (isSameVNodeType(oldVNode, newVNode)) {
                    /*是一个的话说明内容分有所改变，那就改内容 */
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    //如果不一样就跳出来，就要重新挂载节点了
                    break;
                }
                i++;
            }
            /*情况二：自后向前 */ //End--双指针后边的指针
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[oldChildrenEnd];
                var newVNode = normalizeVNnode(newChildren[newChildrenEnd]);
                /*比较两个孩子是不是一个*/
                if (isSameVNodeType(oldVNode, newVNode)) {
                    /*是一个的话说明内容分有所改变，那就改内容 */
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    //如果不一样就跳出来，就要重新挂载节点了
                    break;
                }
                oldChildrenEnd--;
                newChildrenEnd--;
            }
            /*情况三：新节点多于旧节点 */ //比如 a b c => (a b c) d  或者 a b c => d (a b c) => i old new : 0 -1 0
            //这种情况限于上边两个while跑完了其他的所有节点，只剩需要新增的了，不然i不会>oldChildrenEnd
            if (i > oldChildrenEnd) {
                if (i <= newChildrenEnd) {
                    //i<=newChildrenEnd就代表还没又整完，然后第newChildrenEnd不等，跳出了上一个while
                    var nextPos = newChildrenEnd + 1; //instert到它前面
                    var anchor = nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor;
                    while (i <= newChildrenEnd) {
                        //把多出来的加上去，如果又乱序又新增，那种情况后面处理
                        patch(null, normalizeVNnode(newChildren[i]), container, anchor);
                        i++;
                    }
                }
            }
            /*情况四：旧节点多于新节点 */ //比如 d (a b c) => a b c 或者 (a b c) d => a b c => i old new : 3 3 2
            else if (i > newChildrenEnd) {
                while (i <= oldChildrenEnd) {
                    unmount(oldChildren[i]);
                    i++;
                }
            }
            /*情况五 */
            // 5. 乱序的 diff 比对
            else {
                // 旧子节点的开始索引：oldChildrenStart
                var oldStartIndex = i;
                // 新子节点的开始索引：newChildrenStart
                var newStartIndex = i;
                // 5.1 创建一个 <key（新节点的 key）:index（新节点的位置）> 的 Map 对象 keyToNewIndexMap。通过该对象可知：新的 child（根据 key 判断指定 child） 更新后的位置（根据对应的 index 判断）在哪里
                var keyToNewIndexMap = new Map();
                // 通过循环为 keyToNewIndexMap 填充值（s2 = newChildrenStart; e2 = newChildrenEnd）
                for (i = newStartIndex; i <= newChildrenEnd; i++) {
                    // 从 newChildren 中根据开始索引获取每一个 child（c2 = newChildren）
                    var nextChild = normalizeVNnode(newChildren[i]);
                    // child 必须存在 key（这也是为什么 v-for 必须要有 key 的原因）
                    if (nextChild.key != null) {
                        // 把 key 和 对应的索引，放到 keyToNewIndexMap 对象中
                        keyToNewIndexMap.set(nextChild.key, i);
                    }
                }
                // 5.2 循环 oldChildren ，并尝试进行 patch（打补丁）或 unmount（删除）旧节点
                var j 
                // 记录已经修复的新节点数量
                = void 0;
                // 记录已经修复的新节点数量
                var patched = 0;
                // 新节点待修补的数量 = newChildrenEnd - newChildrenStart + 1
                var toBePatched = newChildrenEnd - newStartIndex + 1;
                // 标记位：节点是否需要移动
                var moved = false;
                // 配合 moved 进行使用，它始终保存当前最大的 index 值
                var maxNewIndexSoFar = 0;
                // 创建一个 Array 的对象，用来确定最长递增子序列。它的下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-c 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
                // 但是，需要特别注意的是：oldIndex 的值应该永远 +1 （ 因为 0 代表了特殊含义，他表示《新节点没有找到对应的旧节点，此时需要新增新节点》）。即：旧节点下标为 0， 但是记录时会被记录为 1
                var newIndexToOldIndexMap = new Array(toBePatched);
                // 遍历 toBePatched ，为 newIndexToOldIndexMap 进行初始化，初始化时，所有的元素为 0
                for (i = 0; i < toBePatched; i++)
                    newIndexToOldIndexMap[i] = 0;
                // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），获取旧节点，如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
                for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
                    // 获取旧节点
                    var prevChild = oldChildren[i];
                    // 如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
                    if (patched >= toBePatched) {
                        // 所有的节点都已经更新完成，剩余的旧节点全部删除即可
                        unmount(prevChild);
                        continue;
                    }
                    // 新节点需要存在的位置，需要根据旧节点来进行寻找（包含已处理的节点。即：n-c 被认为是 1）
                    var newIndex 
                    // 旧节点的 key 存在时
                    = void 0;
                    // 旧节点的 key 存在时
                    if (prevChild.key != null) {
                        // 根据旧节点的 key，从 keyToNewIndexMap 中可以获取到新节点对应的位置
                        newIndex = keyToNewIndexMap.get(prevChild.key);
                    }
                    else {
                        // 旧节点的 key 不存在（无 key 节点）
                        // 那么我们就遍历所有的新节点，找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》，如果能找到，那么 newIndex = 该新节点索引
                        for (j = newStartIndex; j <= newChildrenEnd; j++) {
                            // 找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》
                            if (newIndexToOldIndexMap[j - newStartIndex] === 0 &&
                                isSameVNodeType(prevChild, newChildren[j])) {
                                // 如果能找到，那么 newIndex = 该新节点索引
                                newIndex = j;
                                break;
                            }
                        }
                    }
                    // 最终没有找到新节点的索引，则证明：当前旧节点没有对应的新节点
                    if (newIndex === undefined) {
                        // 此时，直接删除即可
                        unmount(prevChild);
                    }
                    // 没有进入 if，则表示：当前旧节点找到了对应的新节点，那么接下来就是要判断对于该新节点而言，是要 patch（打补丁）还是 move（移动）
                    else {
                        // 为 newIndexToOldIndexMap 填充值：下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-c 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
                        // 因为 newIndex 包含已处理的节点，所以需要减去 s2（s2 = newChildrenStart）表示：不计算已处理的节点
                        newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1;
                        // maxNewIndexSoFar 会存储当前最大的 newIndex，它应该是一个递增的，如果没有递增，则证明有节点需要移动
                        if (newIndex >= maxNewIndexSoFar) {
                            // 持续递增
                            maxNewIndexSoFar = newIndex;
                        }
                        else {
                            // 没有递增，则需要移动，moved = true
                            moved = true;
                        }
                        // 打补丁
                        patch(prevChild, newChildren[newIndex], container, null);
                        // 自增已处理的节点数量
                        patched++;
                    }
                }
                // 5.3 针对移动和挂载的处理
                // 仅当节点需要移动的时候，我们才需要生成最长递增子序列，否则只需要有一个空数组即可
                var increasingNewIndexSequence = moved
                    ? getSequence(newIndexToOldIndexMap)
                    : [];
                // j >= 0 表示：初始值为 最长递增子序列的最后下标
                // j < 0 表示：《不存在》最长递增子序列。
                j = increasingNewIndexSequence.length - 1;
                // 倒序循环，以便我们可以使用最后修补的节点作为锚点
                for (i = toBePatched - 1; i >= 0; i--) {
                    // nextIndex（需要更新的新节点下标） = newChildrenStart + i
                    var nextIndex = newStartIndex + i;
                    // 根据 nextIndex 拿到要处理的 新节点
                    var nextChild = newChildren[nextIndex];
                    // 获取锚点（是否超过了最长长度）
                    var anchor = nextIndex + 1 < newChildrenLength ? newChildren[nextIndex + 1].el : parentAnchor;
                    // 如果 newIndexToOldIndexMap 中保存的 value = 0，则表示：新节点没有用对应的旧节点，此时需要挂载新节点
                    if (newIndexToOldIndexMap[i] === 0) {
                        // 挂载新节点
                        patch(null, nextChild, container, anchor);
                    }
                    // moved 为 true，表示需要移动
                    else if (moved) {
                        // j < 0 表示：不存在 最长递增子序列
                        // i !== increasingNewIndexSequence[j] 表示：当前节点不在最后位置
                        // 那么此时就需要 move （移动）
                        if (j < 0 || i !== increasingNewIndexSequence[j]) {
                            move(nextChild, container, anchor);
                        }
                        else {
                            // j 随着循环递减
                            j--;
                        }
                    }
                }
            }
        };
        /**
        * 移动节点到指定位置
        */
        var move = function (vnode, container, anchor) {
            var el = vnode.el;
            hostinsert(el, container, anchor);
        };
        //更新参数 
        var patchProps = function (el, vnode, oldProps, newProps) {
            if (oldProps !== newProps) {
                //更新参数
                for (var key in newProps) {
                    var next = newProps[key];
                    var prev = oldProps[key];
                    if (next !== prev) {
                        hostpatchProp(el, key, prev, next);
                    }
                }
                //还要删除掉旧有新没有的节点
                if (oldProps !== EMPTY_OBJ) {
                    for (var key in oldProps) {
                        if (!(key in newProps)) {
                            hostpatchProp(el, key, oldProps[key], null);
                        }
                    }
                }
            }
        };
        //========================================================
        //具体整体操作
        var patch = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode === newVNode) {
                return;
            }
            /*更新组件也是在这里先卸载 */
            //如果旧节点和新节点的type或key不同，就先卸载
            if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
                unmount(oldVNode);
                oldVNode = null;
            }
            var type = newVNode.type, shapeFlag = newVNode.shapeFlag;
            //通过不同的类型选择不同的更新方式
            switch (type) {
                case Text$1:
                    processText(oldVNode, newVNode, container, anchor);
                    break;
                case Comment:
                    processCommentNode(oldVNode, newVNode, container, anchor);
                    break;
                case Fragment:
                    processFragment(oldVNode, newVNode, container, anchor);
                    break;
                default:
                    //还有两种情况，组件和element
                    if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                        //处理ELEMENT
                        processElement(oldVNode, newVNode, container, anchor);
                    }
                    else if (shapeFlag & 6 /* ShapeFlags.COMPONENT */) {
                        /*组件的处理 */
                        processComponent(oldVNode, newVNode, container, anchor);
                    }
                    else if (shapeFlag === 8 /* ShapeFlags.TEXT_CHILDREN */) {
                        //挂载子节点用:hello{{msg}}【bug纪念碑】
                        processText(oldVNode, newVNode, container, anchor);
                    }
            }
        };
        //渲染总函数
        var render = function (vnode, container) {
            if (vnode === null) {
                //新节点为空，旧节点存在，删除！
                if (container.__v_isVNode) {
                    unmount(container.__v_isVNode);
                }
            }
            else {
                //更新DOM
                patch(container._vnode || null, vnode, container);
            }
            //存储一下旧节点
            container._vnode = vnode;
        };
        //最后调用暴漏在runtime-dom/index中
        return {
            render: render,
            createApp: createAppAPI(render)
        };
    }

    //element操作
    var nodeOps = {
        //兼容的方法
        insert: function (el, parent, anchor) {
            //插入DOM
            parent.insertBefore(el, anchor || null);
        },
        createElement: function (type) {
            //创建DOM
            var el = document.createElement(type);
            return el;
        },
        setElementText: function (el, text) {
            //修改DOM内容
            el.textContent = text;
        },
        remove: function (child) {
            //删除
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        createText: function (text) {
            var el = document.createTextNode(text);
            return el;
        },
        setText: function (node, text) {
            node.nodeValue = text;
        },
        createComment: function (text) { return document.createComment(text); }
    };

    //不同的属性需要不同的设置方式
    //这里是需要使用setAttr设置的属性
    function patchAttr(el, key, nextValue) {
        if (nextValue === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, nextValue);
        }
    }

    //处理class
    function patchClass(el, value) {
        if (value === null) {
            el.removeAttribute('class');
        }
        else {
            el.className = value;
        }
    }

    //事件处理
    function patchEvent(el, rawName, prevValue, nextValue) {
        //添加个vei，作用是缓存，万一同事件，只是回调变了，就不用频繁地处理Dom监听器浪费事件
        var invokers = el._vei || (el._vei = {});
        //获取当前监听事件的回调
        var existingIncoker = invokers[rawName];
        if (nextValue && existingIncoker) {
            //都存在的话只改变回调就好了
            existingIncoker.value = nextValue;
        }
        else {
            //不然就需要添加事件监听了
            //但是名字需要先改变onClick=》click
            var name_1 = parseName(rawName);
            if (nextValue) {
                //没有这个invoker所以需要creat一下
                var invoker = (invokers[rawName] = creatInvoker(nextValue));
                el.addEventListener(name_1, invoker);
            }
            else if (existingIncoker) {
                //新的为空，旧的存在，删除事件，删除缓存
                el.removeEventListener(name_1, existingIncoker);
                invokers[rawName] = undefined;
            }
            //invokers指向el._vei，就直接改变了（存储缓存）
        }
    }
    function parseName(name) {
        return name.slice(2).toLowerCase();
    }
    function creatInvoker(initialValue) {
        //保证了调用invoker可以执行函数
        var invoker = function (e) {
            invoker.value && invoker.value();
        };
        //把回调挂到invoker的value上
        invoker.value = initialValue;
        return invoker;
    }

    //处理dom属性
    function patchDOMProps(el, key, nextValue) {
        el[key] = nextValue;
    }

    //为了简化，没有写缓存
    function patchStyle(el, prevValue, nextValue) {
        //获取旧style并判断新style是否是新string
        var style = el.style;
        var isCssString = isString(nextValue);
        if (nextValue && !isCssString) {
            //新样式挂载
            for (var key in nextValue) {
                //遍历每一个Style的属性，再设置
                setStyle(style, key, nextValue[key]);
            }
            //旧样式清理
            if (prevValue && !isCssString) {
                for (var key in prevValue) {
                    if (!(key in nextValue)) {
                        setStyle(style, key, '');
                    }
                }
            }
        }
    }
    //设置单个属性
    function setStyle(style, name, val) {
        style[name] = val;
    }

    //props操作
    var patchProp = function (el, key, preValue, nextValue) {
        //看下会是什么样的props
        if (key === 'class') {
            //class
            patchClass(el, nextValue);
        }
        else if (key === 'style') {
            //style
            patchStyle(el, preValue, nextValue);
        }
        else if (isOn(key)) {
            //事件
            patchEvent(el, key, preValue, nextValue);
        }
        else if (shouldSetAsProp(el, key)) {
            //不需要setAttribute设置的
            patchDOMProps(el, key, nextValue);
        }
        else {
            //需要setAttribute设置的
            patchAttr(el, key, nextValue);
        }
    };
    //判断是否需要setAttr..的方式添加属性
    function shouldSetAsProp(el, key) {
        if (key === 'form') {
            //form是只读的
            return false;
        }
        if (key === 'list' && el.tagName === 'INPUT') {
            //必须通过attribute设定
            return false;
        }
        if (key === 'type' && el.tagName === 'TEXTAREA') {
            //必须通过attribute设定
            return false;
        }
        return key in el;
    }

    //我要在这里导出render
    //但是render是baseCreatRener的返回值，所以导出麻烦一些
    var RenderOption = extend({ patchProp: patchProp }, nodeOps);
    var renderer;
    //在这里触发
    function ensureRender() {
        return renderer || (renderer = createRender(RenderOption));
    }
    //对外暴漏的render
    var render = function () {
        var arg = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arg[_i] = arguments[_i];
        }
        ensureRender();
        renderer.render.apply(renderer, __spreadArray([], __read(arg), false));
    };
    //对外暴漏的createApp
    var createApp = function () {
        var arg = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arg[_i] = arguments[_i];
        }
        ensureRender();
        var app = renderer.createApp.apply(renderer, __spreadArray([], __read(arg), false));
        var mount = app.mount;
        //重构mount
        app.mount = function (containerOrSelector) {
            var container = normalizeContainer(containerOrSelector);
            if (!container) {
                console.log('容器不存在');
                return null;
            }
            return mount(container);
        };
        return app;
    };
    function normalizeContainer(container) {
        if (isString(container)) {
            return document.querySelector(container);
        }
        else {
            return container;
        }
    }

    var _a;
    var CREATE_ELEMENT_VNODE = Symbol('createElementVNode');
    var CREATE_VNODE = Symbol('createVNode');
    var TO_DISPLAY_STRING = Symbol('toDisplayString');
    var CREATE_COMMENT = Symbol('createCommentVNode');
    var helperNameMap = (_a = {},
        _a[CREATE_ELEMENT_VNODE] = 'createElementVNode',
        _a[CREATE_VNODE] = 'createVNode',
        _a[TO_DISPLAY_STRING] = 'toDisplayString',
        _a[CREATE_COMMENT] = 'createCommentVNode',
        _a);

    //TOOL:判断是不是TEXT节点
    function isText(node) {
        return node.type === 5 /* NodeTypes.INTERPOLATION */ || node.type === 2 /* NodeTypes.TEXT */;
    }
    function getVNodeHelper(ssr, isComponent) {
        return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE;
    }

    //拼接个结构赋值里面的那个字符串：createVNode:_createVNode
    var aliasHelper = function (s) { return "".concat(helperNameMap[s], ":_").concat(helperNameMap[s]); };
    //genetate上下文对象
    function createCodegenContext(ast) {
        var context = {
            code: '',
            runtimeGlobalName: 'MiniVue',
            source: ast.loc.source,
            indentLevel: 0,
            isSSR: false,
            helper: function (key) {
                return "_".concat(helperNameMap[key]);
            },
            push: function (code) {
                context.code += code;
                //拼接render函数字符串
            },
            newline: function () {
                newline(context.indentLevel);
                //换行
            },
            indent: function () {
                newline(++context.indentLevel);
                //进
            },
            deindent: function () {
                newline(--context.indentLevel);
                //缩
            }
        };
        return context;
        function newline(n) {
            context.code += '\n' + "".repeat(n);
        }
    }
    //jsast生成render函数并返回
    function generate(ast) {
        var context = createCodegenContext(ast);
        var push = context.push, newline = context.newline, indent = context.indent, deindent = context.deindent;
        //开始拼接
        //首先是前置代码
        getFunctiopnPreamble(context);
        //函数头：function render(_ctx,_cache)
        var functionName = "render";
        var args = ['_ctx', '_cache'];
        var signature = args.join(',');
        push("function ".concat(functionName, "(").concat(signature, "){"));
        indent();
        //添加with(_ctx)
        push('with(_ctx) {');
        indent();
        //第一行：const { createElementVNode: _createElementVNode } = _Vue
        var hasHelps = ast.helpers.length > 0;
        if (hasHelps) {
            push("const { ".concat(ast.helpers.map(aliasHelper).join(','), " } = _Vue"));
            push('\n');
            newline();
        }
        //第二行节点：return _createElementVNode("div"，[]，["hello word"])
        newline();
        push("return ");
        if (ast.codegenNode) {
            genNode(ast.codegenNode, context);
        }
        else {
            push(" null");
        }
        //最后的大括号
        deindent();
        push('}'); //with的
        deindent();
        push('}'); //总的
        return {
            ast: ast,
            code: context.code
        };
    }
    //----------------------------------------------------------------------------
    //处理节点的那行代码生成：return _createElementVNode("div"，[]，["hello word"]) 
    function genNode(node, context) {
        switch (node.type) {
            case 13 /* NodeTypes.VNODE_CALL */:
                genVNodeCall(node, context);
                break;
            case 2 /* NodeTypes.TEXT */:
                //如果是纯文本节点直接返回
                genText(node, context);
                break;
            case 4 /* NodeTypes.SIMPLE_EXPRESSION */: //复合表达式
                genExpression(node, context);
                break;
            case 5 /* NodeTypes.INTERPOLATION */: //插值表达式
                genInterpolation(node, context);
                break;
            case 8 /* NodeTypes.COMPOUND_EXPRESSION */: //双大括号语法
                genCompoundExpression(node, context);
                break;
            case 9 /* NodeTypes.IF */: //本质也是Element
            case 1 /* NodeTypes.ELEMENT */: //这种一般是嵌套，生产孩子时使用到
                genNode(node.codegenNode, context);
                break;
            case 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */:
                genConditionalExpression(node, context); //就是搞那个三元表达式的内容
                break;
            case 14 /* NodeTypes.JS_CALL_EXPRESSION */:
                genCallExpression(node, context);
                break;
        }
    }
    //----------------------------------------------------------------------------
    //v-if的三元表达式
    /*
    isShow
     ? _createELementVNode("h1"，null，["你好，世界"])
     : _createCommentVNode("v-if"，true)
    */
    function genConditionalExpression(node, context) {
        var test = node.test, needNewLine = node.newline, consquent = node.consquent, alernate = node.alernate;
        var push = context.push, indent = context.indent, deindent = context.deindent, newline = context.newline;
        if (test.type === 4 /* NodeTypes.SIMPLE_EXPRESSION */) {
            genExpression(test, context); //就是处理三元表达式的第一元，isShow
        }
        needNewLine && indent();
        context.indentLevel++;
        //问号
        needNewLine || push(" ");
        push("?");
        //处理满足条件的表达式consquent
        genNode(consquent, context);
        context.indentLevel--;
        needNewLine && newline();
        needNewLine || push(" ");
        //冒号
        push(":");
        //如果不等，有可能后边有else节点
        var isNested = alernate.type === 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */;
        if (!isNested)
            context.indentLevel++;
        //处理不满足条件的表达式alernate
        genNode(alernate, context);
        if (!isNested)
            context.indentLevel--;
        needNewLine && deindent();
    }
    //v-else处理：就是三元不断拼接
    //: _createCommentVNode("v-if"，true)【这里生成node后边的东西】
    function genCallExpression(node, context) {
        var push = context.push, helper = context.helper;
        var callee = isString(node.callee) ? node.callee : helper(node.callee);
        push(callee + "(");
        genNodeList(node.arguments, context);
        push(")");
    }
    //==================================上面是指令处理===================================
    //如果是纯文本节点
    function genText(node, context) {
        context.push(JSON.stringify(node.content));
    }
    //创建节点的函数
    function genVNodeCall(node, context) {
        //_createElementVNode(
        var push = context.push, helper = context.helper;
        var tag = node.tag, props = node.props, children = node.children, patchFlag = node.patchFlag, dynamicProps = node.dynamicProps; node.directives; node.isBlock; node.disableTracking; var isComponent = node.isComponent;
        //获取使用的函数是CREATE_VNODE还是CREATE_ELEMENT_VNODE
        var callHelper = getVNodeHelper(context.isSSR, isComponent);
        push(helper(callHelper) + "(");
        //参数"div"，[]，["hello word"]
        var args = genNullableArgs([tag, props, children, patchFlag, dynamicProps]);
        genNodeList(args, context);
        push(')');
    }
    //处理一下参数"div"，[]，["hello word"],去null
    function genNullableArgs(args) {
        var i = args.length;
        //整理出有效的参数 
        while (i--) {
            if (args[i] != null)
                break;
        }
        return args.slice(0, i + 1).map(function (arg) { return arg || "null"; });
    }
    //处理一下参数"div"，[]，["hello word"]
    function genNodeList(nodes, context) {
        var push = context.push; context.newline;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (isString(node)) {
                push(node);
            }
            else if (Array.isArray(node)) {
                genNodeListAsArray(node, context);
            }
            else {
                genNode(node, context); //对象：递归处理
            }
            if (i < nodes.length - 1) {
                push(','); //参数之间逗号分割
            }
        }
    }
    //处理数组参数
    function genNodeListAsArray(nodes, context) {
        context.push('[');
        genNodeList(nodes, context); //递归处理 
        context.push(']');
    }
    //前置代码：const _Vue = MiniVue
    function getFunctiopnPreamble(context) {
        var push = context.push, runtimeGlobalName = context.runtimeGlobalName, newline = context.newline;
        var VueBinding = runtimeGlobalName;
        push("const _Vue = ".concat(VueBinding));
        newline();
        push("return ");
    }
    //EXPRESSION
    function genExpression(node, context) {
        var content = node.content, isStatic = node.isStatic;
        context.push(isStatic ? JSON.stringify(content) : content);
    }
    //INTERPOLATION
    function genInterpolation(node, context) {
        //主要任务把dispaly函数插进来
        var push = context.push, helper = context.helper;
        push("".concat(helper(TO_DISPLAY_STRING), "("));
        genNode(node.content, context); //此时content是变量名字比如：obj.name
        push(')');
    }
    //CompoundExpression: obj.name + '你好'
    function genCompoundExpression(node, context) {
        //本质上对其中的children分别处理
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            //如果是字符串直接push就行了
            if (isString(child)) {
                context.push(child);
            }
            else {
                // 其他的再走一遍
                genNode(child, context);
            }
        }
    }

    //生成上下文对象
    function createParserContext(content) {
        return {
            source: content
        };
    }
    //生成ast的函数
    function baseParse(content) {
        var context = createParserContext(content);
        //触发处理函数，第二个参数看作一个ElementNode[]
        var children = parseChildren(context, []);
        return createRoot(children);
    }
    // 正儿八经处理的函数
    function parseChildren(context, ancestors) {
        //存储节点
        var nodes = [];
        //循环解析模板
        while (!isEnd(context, ancestors)) {
            var s = context.source;
            var node = void 0;
            if (startsWith(s, '{{')) {
                //__TODO__模板语法
                node = parseInterpolation(context);
            }
            else if (s[0] === '<') {
                //____标签的开始___
                if (/[a-z]/i.test(s[1])) {
                    //后边跟的是字母，那就是标签
                    node = parseElement(context, ancestors);
                }
            }
            if (!node) {
                //node为空待变上边的都没满足，既不是标签开始，也不是结束，只能是文本节点
                node = parseText(context);
            }
            pushNode(nodes, node);
        }
        return nodes;
    }
    //__________________T__O__O__L______F_U_N_C_T_I_O_N__________________
    //TOOL_IMPORTANT:解析element
    function parseElement(context, ancestors) {
        //处理开始标签
        var element = parseTag(context, 0 /* TagType.Start */);
        //子标签-文本,ele添加子节点
        ancestors.push(element);
        var children = parseChildren(context, ancestors);
        ancestors.pop();
        element.children = children;
        //处理结束标签
        if (startsWithEndTagOpen(context.source, element.tag)) {
            //这里调用parseTag的作用是为了游标右移
            parseTag(context, 1 /* TagType.End */);
        }
        //要插入nodes的node
        return element;
    }
    //---------------指令逻辑也在这里开始处理--------------------------------
    //TOOL_IMPORTANT_FOR_OVERTOP:解析标签tag
    function parseTag(context, type) {
        //从source中解析处标签名字
        //以尖括号 < 开始，并以一个或多个由小写字母组成的字符串为标签名，紧随其后可能会有空白字符或其他字符，最后以尖括号 > 结尾的字符串
        var match = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
        var tag = match[1]; //div
        //游标右移 '<div'
        advanceBy(context, match[0].length); //看看gpt解释，很通俗（exec）
        //属性和指令的处理:
        //先将标签的属性以空格为界取出来
        advanceSpaces(context);
        var props = parseAttributes(context, type);
        //游标右移 '>'或者'/>'
        var isSelfClosing = startsWith(context.source, '/>');
        advanceBy(context, isSelfClosing ? 2 : 1);
        return {
            type: 1 /* NodeTypes.ELEMENT */,
            TagType: 0 /* ElementTypes.ELEMENT */,
            children: [],
            props: props,
            tag: tag
        };
    }
    //处理属性（多个）
    function parseAttributes(context, type) {
        var props = [];
        //解析指令
        var attributeNames = new Set();
        while (context.source.length > 0 && !startsWith(context.source, '>') && !startsWith(context.source, '/>')) {
            var attr = parseAttribute(context, attributeNames);
            if (type === 0 /* TagType.Start */) {
                props.push(attr);
            }
        }
        return props;
    }
    //处理属性（单个）
    function parseAttribute(context, nameSet) {
        //字符串中匹配到的第一个非空白字符、非>、/、空格、制表符、回车符、换行符、=字符的连续子串
        var match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
        //拿到指令名
        var name = match[0];
        console.log(name);
        nameSet.add(name);
        advanceBy(context, name.length);
        var value;
        //匹配以任意数量的非空白字符（包括制表符、回车符、换行符和换页符）结尾，后跟一个等于号（=）的字符串
        if (/^[^\t\r\n\f ]*=/.test(context.source)) {
            advanceSpaces(context); //等号前的无用字符去掉
            advanceBy(context, 1); //删除等号
            advanceSpaces(context); //等号后的无用字符去掉
            value = parseAttributeValue(context);
        }
        //判断是不是v-指令
        if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
            //获取指令名字
            var match_1 = /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name);
            var dirname = match_1[1]; //这里的指令名时v-后面的，比如if
            return {
                type: 7 /* NodeTypes.DIRECTIVE */,
                name: dirname,
                exp: value && {
                    type: 4 /* NodeTypes.SIMPLE_EXPRESSION */,
                    content: value.content,
                    isStatic: false,
                    loc: []
                },
                art: undefined,
                modifiers: undefined,
                loc: {}
            };
        }
        //如果时普通属性
        return {
            type: 6 /* NodeTypes.ATTRIBUTE */,
            name: name,
            value: value && {
                type: 2 /* NodeTypes.TEXT */,
                content: value.content,
                loc: {}
            },
            loc: {}
        };
    }
    //处理属性的值
    function parseAttributeValue(context) {
        var content = '';
        var quote = context.source[0]; //单引号或者双引号
        advanceBy(context, 1); //删除第一个引号
        var endIndex = context.source.indexOf(quote);
        if (endIndex === -1) {
            content = parseTextData(context, context.source.length);
        }
        else {
            content = parseTextData(context, endIndex);
            advanceBy(context, 1); //再去掉最后一个引号
        }
        return {
            content: content,
            isQuoted: true,
            loc: []
        };
    }
    //-----------------------------------------------------------------------
    //游标处理，右移非固定步数:处理标签属性-删除空格等无用字符
    function advanceSpaces(context) {
        var match = /^[\t\r\n\f ]+/.exec(context.source);
        if (match) {
            advanceBy(context, match[0].length);
        }
    }
    //TOOL_IMPORTANT:解析文本节点
    function parseText(context) {
        //标记一下结束白名单
        var endTokens = ['<', '{{'];
        var endIndex = context.source.length;
        for (var i = 0; i < endTokens.length; i++) {
            var index = context.source.indexOf(endTokens[i], 1);
            if (index !== -1 && endIndex > index) {
                //随时纠正一下普通文本的下标
                endIndex = index;
            }
        }
        //拿到节点内容，也裁剪好了
        var content = parseTextData(context, endIndex);
        return {
            type: 2 /* NodeTypes.TEXT */,
            content: content
        };
    }
    //TOOL_IMPORTANT_FOR_OVERTOP：解析普通文本内容(截取)
    function parseTextData(context, length) {
        var rawText = context.source.slice(0, length);
        advanceBy(context, length);
        return rawText;
    }
    //TOOL：游标右移
    function advanceBy(context, numberOfCharactoers) {
        var source = context.source;
        //切割一下解析完成的部分
        context.source = source.slice(numberOfCharactoers);
    }
    //TOOL
    function pushNode(nodes, node) {
        nodes.push(node);
    }
    //TOOL：是不是结束标签
    function isEnd(context, ancestors) {
        var s = context.source;
        //如果以结束标签吗开头，就是结束
        if (startsWith(s, '</')) {
            //理论返回true就好了，但是还有很多边缘情况
            for (var i = ancestors.length - 1; i >= 0; --i) {
                if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                    return true;
                }
            }
        }
        return !s;
    }
    /**TOOL：
     * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
     * @param source 模板。例如：</div>
     * @param tag 标签。例如：div
     * @returns
     */
    function startsWithEndTagOpen(source, tag) {
        return startsWith(source, '</');
    }
    //TOOL：字符串是否以**开头
    function startsWith(source, searchString) {
        return source.startsWith(searchString);
    }
    /**
     * 生成 root 节点
     */
    function createRoot(children) {
        return {
            type: 0 /* NodeTypes.ROOT */,
            children: children,
            // loc：位置，这个属性并不影响渲染，但是它必须存在，否则会报错。所以我们给了他一个 {}
            loc: {}
        };
    }
    //=============================================================
    //处理响应式：拿出节点，返回node
    function parseInterpolation(context, ancestors) {
        //{{ XX }} 返回插值表达式节点
        var _a = __read(['{{', '}}'], 2), open = _a[0], close = _a[1];
        //处理游标{{
        advanceBy(context, open.length);
        //拿到内容
        var closeIndex = context.source.indexOf(close, open.length);
        var preTrimContent = parseTextData(context, closeIndex); //解析普通文本内容(截取)
        var content = preTrimContent.trim(); //去空格
        //处理游标}}
        advanceBy(context, close.length);
        return {
            type: 5 /* NodeTypes.INTERPOLATION */,
            content: {
                type: 4 /* NodeTypes.SIMPLE_EXPRESSION */,
                IsStatic: false,
                content: content
            }
        };
    }

    //判断是不是单个element根节点
    function isSingleElementRoot(root, child) {
        var children = root.children;
        return children.length === 1 && (child.type === 1 /* NodeTypes.ELEMENT */ || child.type === 9 /* NodeTypes.IF */);
    }

    //创建上下文对象
    function createTransformContext(root, _a) {
        var _b = _a.nodeTransforms, nodeTransforms = _b === void 0 ? [] : _b;
        var context = {
            nodeTransforms: nodeTransforms,
            root: root,
            helpers: new Map(),
            currentNode: root,
            childIndex: 0,
            helper: function (name) {
                var count = context.helpers.get(name) || 0;
                context.helpers.set(name, count + 1);
                return name;
            },
            parent: null,
            replaceNode: function (node) {
                //v-if让当前正在处理节点换成ifVnode
                context.parent.children[context.childIndex] = context.currentNode = node;
            }
        };
        return context;
    }
    //转化总函数
    function transform(root, options) {
        var context = createTransformContext(root, options);
        //遍历转化节点
        tranverseNode(root, context);
        console.log(context);
        //创建根节点
        createRootCodegen(root);
        //给root导入helpers，是个map，key是函数
        root.helpers = __spreadArray([], __read(context.helpers.keys()), false);
        root.component = [];
        root.directives = [];
        root.imports = [];
        root.hoists = [];
        root.temps = [];
        root.cached = [];
    }
    //遍历转化节点的函数-深度优先原则
    /*
     * 转化的过程分为两个阶段：
     * 1. 进入阶段：存储所有节点的转化函数到 exitFns 中
     * 2. 退出阶段：执行 exitFns 中缓存的转化函数，且一定是倒叙的。因为只有这样才能保证整个处理过程是深度优先的
    */
    function tranverseNode(node, context) {
        //当前正在执行的函数
        context.currentNode = node;
        var nodeTransforms = context.nodeTransforms;
        var exitFns = [];
        for (var i_1 = 0; i_1 < nodeTransforms.length; i_1++) {
            //去执行每一个个transform，如果type不对，会自动return的
            //对了会返回闭包函数的,闭包也保存了当时传进去的参数
            //利用了递归的原理，实现了DFS
            var onExit = nodeTransforms[i_1](node, context);
            if (onExit) {
                if (Array.isArray(onExit)) {
                    //指令处理加得多
                    exitFns.push.apply(exitFns, __spreadArray([], __read(onExit), false));
                }
                else {
                    exitFns.push(onExit);
                }
            }
            //处理指令的时候切换过currentNode，现在校准一下node
            if (!context.currentNode) {
                return;
            }
            else {
                //防止处理ifnode找不到currentNode
                node = context.currentNode;
            }
        }
        switch (node.type) {
            case 10 /* NodeTypes.IF_BRANCH */:
            case 1 /* NodeTypes.ELEMENT */:
            case 0 /* NodeTypes.ROOT */:
                //处理子节点，函数里调用了tranverseNode，子节点的onExit会存到exitFns
                tranverseChildren(node, context);
                break;
            case 5 /* NodeTypes.INTERPOLATION */:
                //处理复合表达式
                //先传入工具函数，TO_DISPLAY_STRING帮助变量读取值
                context.helper(TO_DISPLAY_STRING);
                break;
            case 9 /* NodeTypes.IF */:
                //处理if指令
                //IFNODE包含了branches
                for (var i_2 = 0; i_2 < node.branches.length; i_2++) {
                    tranverseNode(node.branches[i_2], context);
                }
                break;
        }
        context.currentNode = node;
        var i = exitFns.length;
        while (i--) {
            exitFns[i]();
        }
    }
    //处理子节点的函数
    function tranverseChildren(parent, context) {
        parent.children.forEach(function (node, index) {
            context.parent = parent;
            context.childIndex = index;
            tranverseNode(node, context);
        });
    }
    //创建根节点
    function createRootCodegen(root) {
        var children = root.children;
        //vue2支持单个根节点,就先处理单个吧
        if (children.length === 1) {
            var child = children[0];
            if (isSingleElementRoot(root, child) && child.codegenNode) {
                root.codegenNode = child.codegenNode;
            }
        }
        //vue3支持多个根节点
    }
    //***********************************************************************/
    //处理某一个指令，并生成exitFns
    function createStructuralDirectiveTransform(name, fn) {
        //name为正则或者字符串，所以有下边这一出,判断是不是当前处理的指令
        var matches = isString(name) ? function (n) { return n === name; } : function (n) { return name.test(n); };
        return function (node, context) {
            if (node.type === 1 /* NodeTypes.ELEMENT */) {
                var props = node.props;
                var exitFns = [];
                //循环看看是不是当前需要处理的指令
                for (var i = 0; i < props.length; i++) {
                    var prop = props[i];
                    //props，先仅处理指令
                    if (prop.type === 7 /* NodeTypes.DIRECTIVE */ && matches(prop.name)) {
                        props.splice(i, 1);
                        i--; //拿出来了，就在原props删掉就行了
                        var onExit = fn(node, prop, context); //生成闭包，并返回赋值给onExit
                        if (onExit)
                            exitFns.push(onExit);
                    }
                }
                // 返回包含所有函数的数组
                return exitFns;
            }
        };
    }

    function createVNodeCall(context, tag, props, children) {
        if (context) {
            //向helps放置对应的symbol,是一个函数名，在runtimeHelper.ts中查看
            //感觉这个地方有点像python的注册机制
            context.helper(CREATE_ELEMENT_VNODE);
        }
        return {
            type: 13 /* NodeTypes.VNODE_CALL */,
            tag: tag,
            props: props,
            children: children,
        };
    }
    function createConditionalExpression(test, consquent, alernate, newline) {
        return {
            type: 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */,
            test: test,
            consquent: consquent,
            alernate: alernate,
            loc: {}
        };
    }
    //创建对象的属性节点
    function createObjectProperty(key, value) {
        return {
            type: 16 /* NodeTypes.JS_PROPERTY */,
            loc: {},
            key: isString(key) ? createSimpleExpression(key, true) : key,
            value: value
        };
    }
    //创建简单的表达式节点
    function createSimpleExpression(content, isStatic) {
        return {
            type: 16 /* NodeTypes.JS_PROPERTY */,
            loc: {},
            content: content,
            isStatic: isStatic
        };
    }
    //创建注释节点：v-if用
    function createCallExpression(callee, args) {
        return {
            type: 14 /* NodeTypes.JS_CALL_EXPRESSION */,
            loc: {},
            callee: callee,
            arguments: args
        };
    }

    //转化Element-闭包
    //核心作用：新增了codegenNode属性
    var transformElement = function (node, context) {
        return function postTransformElement() {
            node = context.currentNode;
            //不是element节点就不用干了
            if (node.type !== 1 /* NodeTypes.ELEMENT */) {
                return;
            }
            var tag = node.tag; //如：'div'
            var vnodeTag = "\"".concat(tag, "\""); //带变量的字符串
            var vnodeProps = [];
            var vnodeChildren = node.children;
            //transform的关键就是新增了codegenNode属性
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        };
    };

    //转Text
    //核心作用：将相邻的文本节点和表达式节点合并为一个表达式
    /**
     * 例如:
     * <div>hello {{ msg }}</div>
     * 上述模板包含两个节点：
     * 1. hello：TEXT 文本节点
     * 2. {{ msg }}：INTERPOLATION 表达式节点
     * 这两个节点在生成 render 函数时，需要被合并： 'hello' + _toDisplayString(_ctx.msg)
     * 那么在合并时就要多出来这个 + 加号。
     * 例如：
     * children:[
     * 	{ TEXT 文本节点 },
     *  " + ",
     *  { INTERPOLATION 表达式节点 }
     * ]
     */
    //处理孩子
    var transformText = function (node, context) {
        if (
        //transformText只处理以下逻辑的孩子
        node.type === 0 /* NodeTypes.ROOT */ ||
            node.type === 1 /* NodeTypes.ELEMENT */ ||
            node.type === 11 /* NodeTypes.FOR */ ||
            node.type === 10 /* NodeTypes.IF_BRANCH */) {
            return function () {
                var children = node.children;
                var currentContainer;
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (isText(child)) {
                        for (var j = i + 1; j < children.length; j++) {
                            var childNext = children[j];
                            if (isText(childNext)) {
                                if (!currentContainer) {
                                    //先只放了第一个Text节点
                                    //在这里改变了孩子节点，这里改变了node，完成了转化
                                    currentContainer = children[i] = createCompoundExpression([child], child.loc);
                                }
                                //如果相邻两个都是文本节点
                                currentContainer.children.push("+", childNext);
                            }
                            //处理好一个了，就删掉一个j
                            children.splice(j, 1);
                            j--;
                        }
                    }
                    else {
                        //第一个节点是Text，第二个不是
                        currentContainer = undefined;
                        break;
                    }
                }
            };
        }
    };
    //创建符合表达式节点
    function createCompoundExpression(children, loc) {
        return {
            type: 8 /* NodeTypes.COMPOUND_EXPRESSION */,
            loc: loc,
            children: children
        };
    }

    // 制造闭包
    var transformIf = createStructuralDirectiveTransform(/^(if|else|else-if)$/, function (node, dir, context) {
        //返回的函数就是onExit
        return processIf(node, dir, context, function (ifNode, branch, isRoot) {
            //主要干的事是给节点加codegen属性
            var key = 0;
            return function () {
                if (isRoot) {
                    ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context);
                    // node = ifNode
                }
            };
        });
    });
    function processIf(node, dir, context, processCodegen) {
        //真正去处理if指令的代码
        if (dir.name === 'if') {
            // 创建 branch 属性
            var branch = createIfBranch(node, dir);
            // 生成 if 指令节点，包含 branches
            var ifNode = {
                type: 9 /* NodeTypes.IF */,
                loc: {},
                branches: [branch],
                codegenNode: undefined
            };
            //当前正在处理的node = ifVnode
            context.replaceNode(ifNode);
            // 生成对应的 codegen 属性
            if (processCodegen) {
                return processCodegen(ifNode, branch, true);
            }
        }
    }
    //创建 if 指令的 branch 属性节点
    function createIfBranch(node, dir) {
        return {
            type: 10 /* NodeTypes.IF_BRANCH */,
            loc: {},
            condition: dir.exp,
            children: [node]
        };
    }
    //添加codegenNode的函数
    function createCodegenNodeForBranch(branch, keyIndex, context) {
        if (branch.condition) {
            //返回的就是一个节点对象
            return createConditionalExpression(branch.condition, creatChildrenCodegenNode(branch, keyIndex), createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true']));
            //其中第三个参数alernate，代表的是v-if的替代方案，就是不渲染v-if，渲染其他的，就是注释
        }
        else {
            return creatChildrenCodegenNode(branch, keyIndex);
        }
    }
    //创建子节点的codegen
    function creatChildrenCodegenNode(branch, keyIndex) {
        //创建对象的属性节点
        var keyProperty = createObjectProperty('key', createSimpleExpression("".concat(keyIndex), false));
        var children = branch.children;
        var firstChild = children[0];
        var ret = firstChild.codegenNode;
        var vnodeCall = getMemoeryVModeCall(ret);
        //利用keyProperty填充props
        injectProp(vnodeCall, keyProperty);
        return ret;
    }
    //填充props
    function injectProp(node, prop) {
        var propsWithInjection;
        var props = node.type === 13 /* NodeTypes.VNODE_CALL */ ? node.props : node.arguments[2];
        if (props === null || isString(props)) {
            propsWithInjection = createObjecExpression([prop]);
        }
        node.props = propsWithInjection;
    }
    //getMemoeryVModeCall就是花全秀腿模仿一圈源码
    function getMemoeryVModeCall(node) { return node; }
    //createObjecExpression,就是生成props
    function createObjecExpression(properties) {
        return {
            type: 15 /* NodeTypes.JS_OBJECT_EXPRESSION */,
            loc: {},
            properties: properties
        };
    }

    //compile函数的具体操作
    function baseCompile(template, options) {
        //生成ast
        var ast = baseParse(template);
        console.log('ast', ast);
        //ast转jsast
        transform(ast, extend({}, { nodeTransforms: [transformElement, transformText, transformIf] }));
        console.log('JSast', ast);
        //生成render函数并返回
        return generate(ast);
    }

    //编译函数入口
    function compile(template, options) {
        return baseCompile(template);
    }

    //让编译的render函数字符串实实在在地返回函数
    function compileToFunction(template, options) {
        var code = compile(template).code;
        console.log(code);
        var render = new Function(code)();
        return render;
    }
    //传到组件模块，给组件模块编译template用
    registerRuntimeCompiler(compileToFunction);

    exports.Comment = Comment;
    exports.Fragment = Fragment;
    exports.Text = Text$1;
    exports.compile = compileToFunction;
    exports.computed = computed;
    exports.createApp = createApp;
    exports.createCommentVNode = createCommentVNode;
    exports.createElementVNode = createVNode;
    exports.effect = effect;
    exports.h = h;
    exports.queuePreFlushCb = queuePreFlushCb;
    exports.reactive = reactive;
    exports.ref = ref;
    exports.render = render;
    exports.toDisplayString = toDisplayString;
    exports.watch = watch;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
