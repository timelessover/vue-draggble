/** 
 * 可拖曳数据
 * 新数据会赋值三个属性
 * 
*/
class DragData {
    constructor() {
        this.data = {}
    }
    set(key) {
        if (!this.data[key]) {
            this.data[key] = {
                className: '',
                List: [],
                KEY_MAP: {}
            }
        }
        return this.data[key]
    }
    // 获得当前数据
    get(key) {
        return this.data[key]
    }
}

/**
 *  发布订阅
 */
class eventBus {
    constructor() {
        this.listeners = {}
    }
    $on(event, func) {
        const events = this.listeners[event]
        if (!events) {
            this.listeners[event] = []
        }
        this.listeners[event].push(func)
    }
    $once(event, func) {
        const vm = this
        function on(...args) {
            vm.$off(event, on)
            func.apply(vm, args)
        }
        this.$on(event, on)
    }
    $off(event, func) {
        const events = this.listeners[event]
        if (!func || !events) {
            this.listeners[event] = []
            return
        }
        this.listeners[event] = this.listeners[event].filter(i => i !== func)
    }
    $emit(event, context) {
        const events = this.listeners[event]
        if (events && events.length > 0) {
            events.forEach(func => {
                func(context)
            })
        }
    }
}
/**
 *  元素事件绑定，删减 class
 */
const _ = {
    on(el, type, fn) {
        el.addEventListener(type, fn)
    },
    off(el, type, fn) {
        el.removeEventListener(type, fn)
    },
    addClass(el, cls) {
        if (arguments.length < 2) {
            el.classList.add(cls)
        } else {
            for (let i = 1, len = arguments.length; i < len; i++) {
                el.classList.add(arguments[i])
            }
        }
    },
    removeClass(el, cls) {
        if (arguments.length < 2) {
            el.classList.remove(cls)
        } else {
            for (let i = 1, len = arguments.length; i < len; i++) {
                el.classList.remove(arguments[i])
            }
        }
    }
}


var vueDrag = function (Vue) {
    const dragData = new DragData()
    const $dragging = new eventBus()
    let isSwap = false
    let Current = null
    /**
    *  点击事件触发执行 
    */
    function handleDragStart(e) {
        const el = getBlockEl(e.target)

        const key = el.getAttribute('drag_group')
        const drag_key = el.getAttribute('drag_key')
        const comb = el.getAttribute('comb')

        const new_key = dragData.set(key)
        const item = new_key.KEY_MAP[drag_key]
        const index = new_key.List.indexOf(item)
        const groupArr = new_key.List.filter(item => item[comb])
        _.addClass(el, 'dragging')

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text', JSON.stringify(item))
        }

        Current = {
            index,
            item,
            el,
            group: key,
            groupArr
        }
    }
    /**
     * 获取可拖曳元素
     */
    function getBlockEl(el) {
        if (!el) return
        while (el.parentNode) {
            if (el.getAttribute && el.getAttribute('drag_block')) {
                return el
            } else {
                el = el.parentNode
            }
        }
    }
    /**
     * 阻止拖曳过程默认事件 
     */
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault()
        }
        return false
    }
    /**
     *  拖入该区域的触发
     */
    function handleDragEnter(e) {
        let el
        if (e.type === 'touchmove') {
            e.stopPropagation()
            e.preventDefault()
            el = getOverElementFromTouch(e)
            el = getBlockEl(el)
        } else {
            el = getBlockEl(e.target)
        }

        if (!el || !Current) return

        const key = el.getAttribute('drag_group')

        if (key !== Current.group || !Current.el || !Current.item || el === Current.el) return

        const drag_key = el.getAttribute('drag_key')
        const new_key = dragData.set(key)
        const item = new_key.KEY_MAP[drag_key]

        if (item === Current.item) return

        const indexTo = new_key.List.indexOf(item)
        const indexFrom = new_key.List.indexOf(Current.item)

        swapArrayElements(new_key.List, indexFrom, indexTo)

        Current.groupArr.forEach(item => {
            if (item != Current.item) {
                new_key.List.splice(new_key.List.indexOf(item), 1)
            }
        })

        let targetIndex = new_key.List.indexOf(Current.item)
        if (Current.groupArr.length) {
            new_key.List.splice(targetIndex, 1, ...Current.groupArr)
        }

        Current.index = indexTo
        isSwap = true
        $dragging.$emit('dragged', {
            draged: Current.item,
            to: item,
            value: new_key.value,
            group: key
        })
    }
    /**
     *  拖放后离开状态
     */
    function handleDragLeave(e) {
        _.removeClass(getBlockEl(e.target), 'drag-over', 'drag-enter')
    }
    /**
     *  拖放后离开状态
     */
    function handleDragEnd(e) {
        const el = getBlockEl(e.target)
        _.removeClass(el, 'dragging', 'drag-over', 'drag-enter')
        Current = null
        isSwap = false
        const group = el.getAttribute('drag_group')
        $dragging.$emit('dragend', { group })
    }
    /**
     *  阻止拖曳结束冒泡处理
     */
    function handleDrop(e) {
        e.preventDefault()
        if (e.stopPropagation) {
            e.stopPropagation()
        }
        return false
    }
    /**
    *  交换数组节点，用$set触发响应式
    */
    function swapArrayElements(items, indexFrom, indexTo) {
        let item = items[indexTo]
        Vue.set(items, indexTo, items[indexFrom])
        Vue.set(items, indexFrom, item)
        return items
    }

    function getOverElementFromTouch(e) {
        const touch = e.touches[0]
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        return el
    }
    /**
     *  添加节点
     */
    function addDragItem(el, binding, vnode) {
        const item = binding.value.item
        const list = binding.value.list
        const new_key = dragData.set(binding.value.group)

        const drag_key = vnode.key
        new_key.value = binding.value
        new_key.className = binding.value.className
        new_key.KEY_MAP[drag_key] = item
        if (list && new_key.List !== list) {
            new_key.List = list
        }
        el.setAttribute('draggable', 'true')
        el.setAttribute('drag_group', binding.value.group)
        el.setAttribute('drag_block', binding.value.group)
        el.setAttribute('drag_key', drag_key)
        el.setAttribute('comb', binding.value.comb)

        _.on(el, 'dragstart', handleDragStart)
        _.on(el, 'dragenter', handleDragEnter)
        _.on(el, 'dragover', handleDragOver)
        _.on(el, 'dragleave', handleDragLeave)
        _.on(el, 'dragend', handleDragEnd)
        _.on(el, 'drop', handleDrop)

        _.on(el, 'touchstart', handleDragStart)
        _.on(el, 'touchmove', handleDragEnter)
        _.on(el, 'touchend', handleDragEnd)
    }
    /**
     *  删除节点
     */
    function removeDragItem(el, binding, vnode) {
        const new_key = dragData.set(binding.value.group)
        const drag_key = vnode.key
        new_key.KEY_MAP[drag_key] = undefined
        _.off(el, 'dragstart', handleDragStart)
        _.off(el, 'dragenter', handleDragEnter)
        _.off(el, 'dragover', handleDragOver)
        _.off(el, 'drag', handleDrag)
        _.off(el, 'dragleave', handleDragLeave)
        _.off(el, 'dragend', handleDragEnd)
        _.off(el, 'drop', handleDrop)

        _.off(el, 'touchstart', handleDragStart)
        _.off(el, 'touchmove', handleDragEnter)
        _.off(el, 'touchend', handleDragEnd)
    }

    Vue.prototype.$dragging = $dragging

    Vue.directive('dragging', {
        bind: addDragItem,
        update(el, binding, vnode) {
            const new_key = dragData.set(binding.value.group)
            const item = binding.value.item
            const list = binding.value.list

            const drag_key = vnode.key
            const old_item = new_key.KEY_MAP[drag_key]
            if (item && old_item !== item) {
                new_key.KEY_MAP[drag_key] = item
            }
            if (list && new_key.List !== list) {
                new_key.List = list
            }
        },
        unbind: removeDragItem
    })

}






