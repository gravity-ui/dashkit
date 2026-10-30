import type {ReactGridLayoutProps} from '../../typings';

import {requireValue} from './invariants';
import {DDManager, GridStack, Utils} from './runtime';
import type {DDElementHost, GridItemHTMLElement, GridStackNode, GridStackOptions} from './runtime';

type Transform = {xScale: number; yScale: number; xOffset: number; yOffset: number};
type NativeDraggable = {
    dragTransform: Transform;
    dragOffset?: {offsetX: number; offsetTop: number};
    helperContainment?: HTMLElement;
};
type NativeResizable = {
    option: {
        maxWidth: number;
        maxWidthMoveLeft: number;
        maxHeight: number;
        maxHeightMoveUp: number;
    };
    rectScale: {x: number; y: number};
    startEvent?: MouseEvent;
    originalRect?: DOMRect;
    temporalRect?: {width: number; height: number; left: number; right: number; top: number};
    scrollEl: HTMLElement;
    scrollY: number;
    scrolled: number;
};
type UI = {position: {left: number; top: number}; size?: {width: number; height: number}};
type NativeInternals = {
    dragTransform: Transform;
    placeholder: GridItemHTMLElement;
    _extraDragRow?: number;
    _leave(el: GridItemHTMLElement, helper?: GridItemHTMLElement): void;
    _updateContainerHeight(): GridStack;
    _writePosAttr(el: GridItemHTMLElement, node: GridStackNode): GridStack;
    _onStartMoving(
        el: GridItemHTMLElement,
        event: Event,
        ui: UI,
        node: GridStackNode,
        width: number,
        height: number,
    ): void;
    _dragOrResize(
        el: GridItemHTMLElement,
        event: Event,
        ui: UI,
        node: GridStackNode,
        width: number,
        height: number,
    ): void;
};
const NativeBase = GridStack as unknown as new (
    root: HTMLElement,
    options: GridStackOptions,
) => GridStack & NativeInternals;

/** Keep DashKit transform options at the native DOM boundary, outside React's portal subtree. */
export class DashKitNativeGrid extends NativeBase {
    properties?: () => ReactGridLayoutProps;
    onCancel?: () => void;
    private resizeEvent?: MouseEvent;
    private resizeLimits?: NativeResizable['option'];
    private motionEvent?: Pick<MouseEvent, 'clientX' | 'clientY'>;

    constructor(root: HTMLElement, options: GridStackOptions) {
        super(root, options);
        const target = (root as DDElementHost).ddElement?.ddDroppable as
            | (NonNullable<NonNullable<DDElementHost['ddElement']>['ddDroppable']> & {
                  _mouseEnter(event: MouseEvent): void;
              })
            | undefined;
        if (target) {
            const enter = target._mouseEnter.bind(target);
            target.disable();
            target._mouseEnter = (event) => {
                // GridStack synthesizes parent entry on nested leave even beyond the parent bounds.
                const rect = root.getBoundingClientRect();
                if (
                    event.clientX >= rect.left &&
                    event.clientX < rect.right &&
                    event.clientY >= rect.top &&
                    event.clientY < rect.bottom
                ) {
                    enter(event);
                }
            };
            target.enable();
        }
    }

    cancelDrag() {
        // React owns these portal targets; native cancellation must not delete external subtrees.
        this.onCancel?.();
    }

    hasPreview() {
        return this.placeholder.parentElement === this.el;
    }

    _leave(el: GridItemHTMLElement, helper?: GridItemHTMLElement) {
        // A newly accepted grid calls _leave again after owning DDManager.dropElement.
        const next = DDManager.dropElement;
        if (this.properties?.().isBounded && this.hasPreview() && (!next || next.el === this.el)) {
            return;
        }
        super._leave(el, helper);
    }

    refreshMotionScale(el: GridItemHTMLElement, event: Event, resize: boolean) {
        this.refreshScale(el, true, resize);
        this.motionEvent = (event as TouchEvent).touches?.[0] || (event as MouseEvent);
    }

    _updateContainerHeight() {
        const props = this.properties?.();
        if (!props) {
            return super._updateContainerHeight();
        }
        if (this.engine && !this.engine.batchMode) {
            const bottom = this.engine.nodes.reduce(
                (max, node) =>
                    Math.max(max, requireValue(node.y, 'node.y') + requireValue(node.h, 'node.h')),
                0,
            );
            const paddingY = props.containerPadding?.[1] ?? 0;
            const fixed = props.autoSize === false || props.style?.height !== undefined;
            const wrapper = this.el.parentElement;
            // Read the fixed canvas before writing heights; GridStack's default height is replaced here.
            const fixedHeight = fixed ? wrapper?.clientHeight || 0 : 0;
            this.el.setAttribute(
                'gs-current-row',
                String(this.getRow() + (this._extraDragRow || 0)),
            );
            if (wrapper && !fixed) {
                wrapper.style.height = `${bottom ? Math.max(0, bottom * this.getCellHeight(true) - (props.margin?.[1] ?? 2) + 2 * paddingY) : 0}px`;
            }
            this.el.style.minHeight = '';
            this.el.style.height = fixed
                ? `${Math.max(0, fixedHeight - 2 * paddingY)}px`
                : `${Math.max(0, bottom * this.getCellHeight(true) - (props.margin?.[1] ?? 2))}px`;
        }
        return this;
    }

    setDragHandles(el: GridItemHTMLElement, selector: string, elements: Element[]) {
        const draggable = (el as DDElementHost).ddElement?.ddDraggable;
        if (!draggable) {
            return;
        }
        // GridStack 12.6 caches handle targets; preserve native callbacks and React resize portals.
        const native = draggable as typeof draggable & {dragEls: Element[]};
        if (
            native.option.handle === selector &&
            native.dragEls.length === elements.length &&
            elements.every((element, index) => element === native.dragEls[index])
        ) {
            return;
        }
        native.disable();
        native.updateOption({handle: selector});
        native.dragEls = elements;
        native.enable();
        this.opts.draggable = {...this.opts.draggable, handle: selector};
        this.prepareDragDrop(el);
    }

    refreshPositions() {
        this._updateContainerHeight();
        this.engine.nodes.forEach((node) => node.el && this._writePosAttr(node.el, node));
    }

    _writePosAttr(elInput: GridItemHTMLElement, node: GridStackNode) {
        const el = elInput;
        super._writePosAttr(el, node);
        if (
            (!el.classList.contains('ui-draggable-dragging') &&
                !el.classList.contains('ui-resizable-resizing')) ||
            el.classList.contains('grid-stack-placeholder')
        ) {
            if (this.properties?.().useCSSTransforms === false) {
                el.style.transform = '';
            } else {
                // The canvas owns this unscaled pixel width; DOM measurement here forces layout per node.
                const width = parseFloat(this.el.style.width);
                const cellWidth = Number.isFinite(width)
                    ? width / this.getColumn()
                    : this.cellWidth();
                el.style.transform = `translate(${(node.x || 0) * cellWidth}px, ${(node.y || 0) * this.getCellHeight(true)}px)`;
                el.style.left = '0px';
                el.style.top = '0px';
            }
        }
        return this;
    }

    _onStartMoving(
        elInput: GridItemHTMLElement,
        event: Event,
        uiInput: UI,
        node: GridStackNode,
        width: number,
        height: number,
    ) {
        const el = elInput;
        let ui = uiInput;
        const host = el as GridItemHTMLElement & {
            ddElement?: {
                ddResizable?: NativeResizable;
                ddDraggable?: {
                    mouseDownEvent?: MouseEvent;
                    dragOffset?: {offsetX: number; offsetTop: number};
                    _dragFollow(event: MouseEvent): void;
                    ui(): UI;
                };
            };
        };
        const drag = event.type === 'dragstart' ? host.ddElement?.ddDraggable : undefined;
        el.style.transform = '';
        if (event.type === 'dragstart') {
            ui = this.boundDrag(el, drag?.ui() || ui);
        }
        super._onStartMoving(el, event, ui, node, width, height);
        if (event.type === 'resizestart') {
            this.resizeEvent = event as MouseEvent;
            const resize = host.ddElement?.ddResizable;
            this.resizeLimits = resize ? {...resize.option} : undefined;
        }
        // Native start already captured the widget rectangle before its transform was cleared.
        this.refreshScale(el, event.type !== 'resizestart', event.type === 'resizestart');
        if (drag?.mouseDownEvent && drag.dragOffset) {
            const pointer = event as MouseEvent;
            // Native dragging anchors at the first move; retain the grab point from mousedown.
            const dx = pointer.clientX - drag.mouseDownEvent.clientX;
            drag.dragOffset.offsetX += this.opts.rtl ? -dx : dx;
            drag.dragOffset.offsetTop += pointer.clientY - drag.mouseDownEvent.clientY;
            drag._dragFollow(pointer);
            this._dragOrResize(
                el,
                Utils.initEvent(pointer, {type: 'drag'}),
                drag.ui(),
                node,
                width,
                height,
            );
        }
    }

    _dragOrResize(
        el: GridItemHTMLElement,
        event: Event,
        uiInput: UI,
        nodeInput: GridStackNode,
        width: number,
        height: number,
    ) {
        let ui = uiInput;
        const node = nodeInput;
        if (event.type === 'drag' && el.gridstackNode !== node) {
            return;
        }
        const pointer = event as MouseEvent;
        const motion = this.motionEvent;
        this.motionEvent = undefined;
        if (!motion || motion.clientX !== pointer.clientX || motion.clientY !== pointer.clientY) {
            this.refreshScale(el, true, event.type === 'resize');
        }
        if (event.type === 'resize') {
            this.resizeEvent = event as MouseEvent;
        }
        if (event.type === 'drag') {
            ui = this.boundDrag(el, ui);
        }
        const moving = node as GridStackNode & {_temporaryRemoved?: boolean};
        if (event.type === 'drag' && moving._temporaryRemoved && el.gridstackNode === node) {
            // A short auto-sized source must keep following the pointer until another grid accepts it.
            this.placeholder.gridstackNode = node;
            this.el.appendChild(this.placeholder);
            node.el = this.placeholder;
            this.engine.addNode(node);
        }
        super._dragOrResize(el, event, ui, node, width, height);
    }

    refreshScale(el: GridItemHTMLElement, rebaseResize = true, resize = false) {
        const props = this.properties?.();
        const scale = props?.transformScaleRef?.current ?? props?.transformScale;
        if (scale !== undefined && (!Number.isFinite(scale) || scale <= 0)) {
            throw new Error('DashKitGridStack: transformScale must be finite and positive');
        }
        const gridTransform =
            scale === undefined
                ? Utils.getValuesFromTransformedElement(this.el)
                : {
                      xScale: 1 / scale,
                      yScale: 1 / scale,
                      xOffset: this.dragTransform.xOffset,
                      yOffset: this.dragTransform.yOffset,
                  };
        const {xScale, yScale} = gridTransform;
        if (!Number.isFinite(xScale) || xScale <= 0 || !Number.isFinite(yScale) || yScale <= 0) {
            throw new Error('DashKitGridStack: transformScale must be finite and positive');
        }
        this.dragTransform.xScale = xScale;
        this.dragTransform.yScale = yScale;
        if (scale === undefined) {
            this.dragTransform.xOffset = gridTransform.xOffset;
            this.dragTransform.yOffset = gridTransform.yOffset;
        }
        const element = el as GridItemHTMLElement & {
            ddElement?: {
                ddDraggable?: NativeDraggable;
                ddResizable?: NativeResizable;
            };
        };
        if (!resize && element.ddElement?.ddDraggable) {
            this.refreshDraggableScale(element.ddElement.ddDraggable, scale, xScale, yScale);
        }
        if (resize && element.ddElement?.ddResizable) {
            this.refreshResizableScale(
                el,
                element.ddElement.ddResizable,
                scale,
                xScale,
                yScale,
                rebaseResize,
            );
        }
    }

    private refreshResizableScale(
        el: GridItemHTMLElement,
        resizeInput: NativeResizable,
        scale: number | undefined,
        xScale: number,
        yScale: number,
        rebaseResize: boolean,
    ) {
        const resize = resizeInput;
        const resizeTransform =
            scale === undefined && el.parentElement
                ? Utils.getValuesFromTransformedElement(el.parentElement)
                : undefined;
        const nextScale = {
            x: resizeTransform?.xScale ?? xScale,
            y: resizeTransform?.yScale ?? yScale,
        };
        if (resize.startEvent && this.resizeLimits) {
            // Native maxima clamp screen pixels; retain layout limits when zoom changes.
            resize.option.maxWidth = this.resizeLimits.maxWidth / nextScale.x;
            resize.option.maxWidthMoveLeft = this.resizeLimits.maxWidthMoveLeft / nextScale.x;
            resize.option.maxHeight = this.resizeLimits.maxHeight / nextScale.y;
            resize.option.maxHeightMoveUp = this.resizeLimits.maxHeightMoveUp / nextScale.y;
        }
        if (
            rebaseResize &&
            resize.startEvent &&
            resize.originalRect &&
            (resize.rectScale.x !== nextScale.x || resize.rectScale.y !== nextScale.y)
        ) {
            // Native resize deltas use screen pixels; retain current layout units after zoom.
            resize.originalRect = el.getBoundingClientRect();
            resize.startEvent = this.resizeEvent || resize.startEvent;
            resize.scrollY = resize.scrollEl.scrollTop;
            resize.scrolled = 0;
            delete resize.temporalRect;
        }
        resize.rectScale = nextScale;
    }

    private refreshDraggableScale(
        drag: NativeDraggable,
        scale: number | undefined,
        xScale: number,
        yScale: number,
    ) {
        const previous = drag.dragTransform;
        const current =
            scale === undefined && drag.helperContainment
                ? Utils.getValuesFromTransformedElement(drag.helperContainment)
                : undefined;
        const dragXScale = current?.xScale ?? xScale;
        const dragYScale = current?.yScale ?? yScale;
        if (
            !Number.isFinite(dragXScale) ||
            dragXScale <= 0 ||
            !Number.isFinite(dragYScale) ||
            dragYScale <= 0
        ) {
            throw new Error('DashKitGridStack: transformScale must be finite and positive');
        }
        const offset = drag.dragOffset;
        if (
            offset &&
            drag.helperContainment &&
            (previous.xScale !== dragXScale || previous.yScale !== dragYScale)
        ) {
            const transform =
                current ?? Utils.getValuesFromTransformedElement(drag.helperContainment);
            // Keep the original unscaled grab point when zoom changes during a drag.
            offset.offsetX =
                ((offset.offsetX + previous.xOffset) * previous.xScale) / dragXScale -
                transform.xOffset;
            offset.offsetTop =
                ((offset.offsetTop + previous.yOffset) * previous.yScale) / dragYScale -
                transform.yOffset;
            previous.xOffset = transform.xOffset;
            previous.yOffset = transform.yOffset;
        }
        previous.xScale = dragXScale;
        previous.yScale = dragYScale;
    }

    private boundDrag(elInput: GridItemHTMLElement, ui: UI): UI {
        const el = elInput;
        if (!this.properties?.().isBounded) {
            return ui;
        }
        const bounds = this.el.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const scaleX = this.el.clientWidth / bounds.width || 1;
        const scaleY = this.el.clientHeight / bounds.height || 1;
        const helperScaleX = el.offsetWidth / rect.width || 1;
        const helperScaleY = el.offsetHeight / rect.height || 1;
        const dx =
            Math.max(bounds.left, Math.min(rect.left, bounds.right - rect.width)) - rect.left;
        const dy = Math.max(bounds.top, Math.min(rect.top, bounds.bottom - rect.height)) - rect.top;
        // Native drag helpers are fixed-positioned and can escape even when the engine is bounded.
        if (dx) {
            if (this.opts.rtl) {
                el.style.right = `${(parseFloat(el.style.right) || 0) - dx * helperScaleX}px`;
            } else {
                el.style.left = `${(parseFloat(el.style.left) || 0) + dx * helperScaleX}px`;
            }
        }
        if (dy) {
            el.style.top = `${(parseFloat(el.style.top) || 0) + dy * helperScaleY}px`;
        }
        return {
            ...ui,
            position: {
                left: ui.position.left + (this.opts.rtl ? -dx : dx) * scaleX,
                top: ui.position.top + dy * scaleY,
            },
        };
    }
}
