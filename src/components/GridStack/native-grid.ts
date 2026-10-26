import type {ReactGridLayoutProps} from '../../typings';

import {requireValue} from './invariants';
import {GridStack, Utils} from './runtime';
import type {DDElementHost, GridItemHTMLElement, GridStackNode, GridStackOptions} from './runtime';

type UI = {position: {left: number; top: number}; size?: {width: number; height: number}};
type NativeInternals = {
    _extraDragRow?: number;
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

    cancelDrag() {
        // React owns these portal targets; native cancellation must not delete external subtrees.
        this.onCancel?.();
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
            ui = drag?.ui() || ui;
        }
        super._onStartMoving(el, event, ui, node, width, height);
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
}
