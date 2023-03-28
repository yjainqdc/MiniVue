//直接从源码中拿过来的
export const enum ShapeFlags {
    // 对应type=element  00000001
    ELEMENT = 1,
    // 函数式组件  00000010
    FUNCTIONAL_COMPONENT = 1 << 1,
    // 有状态的组件 00000100
    STATEFUL_COMPONENT = 1 << 2,
    // children = Text
    TEXT_CHILDREN = 1 << 3,
    // children = array
    ARRAY_CHILDREN = 1 << 4,
    // children = slot
    SLOTS_CHILDREN = 1 << 5,
    // 内置组件两个
    TELEPORT = 1 << 6,
    SUSPENSE = 1 << 7,
    // keepalive（缓存）
    COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
    COMPONENT_KEPT_ALIVE = 1 << 9,
    // 组件：有状态(响应数据)组件|函数组件
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
  }
  