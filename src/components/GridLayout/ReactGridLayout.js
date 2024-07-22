import React from 'react';

import ReactGridLayout, {WidthProvider, utils} from 'react-grid-layout';

import {OVERLAY_CLASS_NAME} from '../../constants';

const {compact, compactType} = utils;

// pointer-events disabled to make mouse events be able to passthrought
// while dragging element out of the grid the mouse positioned over grid item
// so there is only two ways to get it, calculate rect or just give browser make his work
const DRAGGING_PLACEHOLDER_STYLE = {pointerEvents: 'none'};

// when shared element is dragged over another group we still creating placeholder for it
// cause react-grid-layout is havely dependent on this element
// while in future there will be some wey not to create dummy div and hide it with opacity
// this hack is all what i've got now
const DRAGGING_PLACEHOLDER_HIDDEN_STYLE = {...DRAGGING_PLACEHOLDER_STYLE, opacity: 0};

class DragOverLayout extends ReactGridLayout {
    constructor(...args) {
        super(...args);

        this.parentOnDrag = this.onDrag;
        this.onDrag = this.extendedOnDrag;

        this.parentOnDragStop = this.onDragStop;
        this.onDragStop = this.extendedOnDragStop;
    }

    _isExited = false;
    _savedLayout = null;
    _savesActiveDragId = null;

    componentDidMount() {
        super.componentDidMount?.();

        // If cursor is moved out of the window there is a bug
        // which leaves placeholder element in grid, this action needed to reset this state
        window.addEventListener('dragend', this.resetExternalPlaceholder);
        const innerElement = this.getInnerElement();

        if (innerElement) {
            innerElement.addEventListener('mouseup', this.mouseUpHandler);
            innerElement.addEventListener('mouseenter', this.mouseEnterHandler);
            innerElement.addEventListener('mouseleave', this.mouseLeaveHandler);
            innerElement.addEventListener('mousemove', this.mouseMoveHandler);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('dragend', this.resetExternalPlaceholder);
        const innerElement = this.getInnerElement();

        if (innerElement) {
            innerElement.removeEventListener('mouseup', this.mouseUpHandler);
            innerElement.removeEventListener('mouseenter', this.mouseEnterHandler);
            innerElement.removeEventListener('mouseleave', this.mouseLeaveHandler);
            innerElement.removeEventListener('mousemove', this.mouseMoveHandler);
        }

        // Resetting instance props
        this._isExited = false;
        this._savedLayout = null;
        this._savesActiveDragId = null;
    }

    containerHeight() {
        // react-grid-layout doens't calculate it's height when last element is removed
        // and just keeps the previous value
        // so for autosize to work in that case we are resetting it's height value
        if (this.props.autoSize && this.state.layout.length === 0) {
            return;
        }

        return super.containerHeight();
    }

    // innerRef is passed by WithProvider without this wrapper there are only
    // * findDOMNode - deprecated
    // * rewrite whole ReactGridLayout.render method
    // so in that case don't try to use this class on it's own
    // or pass innerRef: React.MutableRef as it's not optional prop
    getInnerElement() {
        return this.props.innerRef?.current || null;
    }

    extendedOnDrag = (i, x, y, sintEv) => {
        const {e} = sintEv;
        const rect = this.getInnerElement()?.getBoundingClientRect() ?? null;

        if (
            rect &&
            (rect.bottom <= e.clientY ||
                rect.top >= e.clientY ||
                rect.left >= e.clientX ||
                rect.right <= e.clientX)
        ) {
            if (!this._isExited) {
                this.hideLocalPlaceholder(i);
                this._isExited = true;
                this.props.onDragExit?.();
            }

            return;
        }

        this._isExited = false;

        this.parentOnDrag(i, x, y, sintEv);
    };

    extendedOnDragStop = (i, x, y, sintEv) => {
        // Restoring layout if item was dropped outside of the grid
        if (this._isExited && this._savedLayout) {
            const l = utils.getLayoutItem(this._savedLayout, i);

            // Create placeholder (display only)
            const placeholder = {
                w: l.w,
                h: l.h,
                x: l.x,
                y: l.y,
                placeholder: true,
                i: i,
            };
            const savedLayout = this._savedLayout;

            this.setState(
                {
                    layout: savedLayout,
                    activeDrag: placeholder,
                },
                () => {
                    this.parentOnDragStop(i, x, y, sintEv);
                },
            );
        } else {
            this.parentOnDragStop(i, x, y, sintEv);
        }

        this._savedLayout = null;
        this._savesActiveDragId = null;
        this._isExited = false;
    };

    // Proxy mouse events -> drag methods for dnd between groups
    mouseEnterHandler = (e) => {
        if (this.props.sourceGroup) {
            this.onDragEnter(e);
        }
    };

    mouseLeaveHandler = (e) => {
        if (this.props.sourceGroup) {
            this.onDragLeave(e);
        }
    };

    mouseMoveHandler = (e) => {
        if (this.props.sourceGroup) {
            this.onDragOver(e);
        }
    };

    mouseUpHandler = (e) => {
        if (this.props.sourceGroup) {
            e.preventDefault();
            e.stopPropagation();
            const {droppingItem} = this.props;
            const {layout} = this.state;
            const item = layout.find((l) => l.i === droppingItem.i);

            // reset dragEnter counter on drop
            this.resetExternalPlaceholder();

            this.props.onSharedDrop(layout, item, e);
        }
    };

    // Reset placeholder when item dragged from outside
    resetExternalPlaceholder = () => {
        if (this.dragEnterCounter) {
            this.dragEnterCounter = 0;
            this.removeDroppingPlaceholder();
        }
    };

    // Hide placeholder when element is dragged out
    hideLocalPlaceholder = (i) => {
        const {layout} = this.state;
        const {cols} = this.props;
        this._savedLayout = layout.map((item) => ({...item}));

        let hiddenElement;
        const newLayout = compact(
            layout.filter((item) => {
                if (item.i === i) {
                    hiddenElement = item;
                    return false;
                }

                return true;
            }),
            compactType(this.props),
            cols,
        );

        if (hiddenElement) {
            newLayout.push(hiddenElement);
        }

        this._savesActiveDragId = hiddenElement.i;
        this.setState({
            activeDrag: null,
            layout: newLayout,
        });
        this.resetExternalPlaceholder();
    };

    // Drop item from outside gets 0,0 droppingPosition
    // centering cursor on newly creted grid item
    // And cause grid-layout using it's own GridItem to make it look
    // like overlay adding className
    processGridItem(child, isDroppingItem) {
        const gridItem = super.processGridItem?.(child, isDroppingItem);

        if (!gridItem) {
            return gridItem;
        }
        const {props: itemProps} = gridItem;

        if (isDroppingItem) {
            const {
                containerWidth,
                cols,
                w,
                h,
                rowHeight,
                margin,
                transformScale,
                droppingPosition,
            } = itemProps;

            const leftOffset = (((containerWidth / cols) * w) / 2 || 0) * transformScale;
            const topOffset = ((h * rowHeight + (h - 1) * margin[1]) / 2 || 0) * transformScale;

            const dragStyles = this.props.sourceGroup
                ? DRAGGING_PLACEHOLDER_HIDDEN_STYLE
                : DRAGGING_PLACEHOLDER_STYLE;

            // React.cloneElement is just cleaner then copy-paste whole processGridItem method
            return React.cloneElement(gridItem, {
                style: itemProps.style ? {...itemProps.style, ...dragStyles} : dragStyles,
                className: OVERLAY_CLASS_NAME,
                droppingPosition: {
                    ...droppingPosition,
                    left: droppingPosition.left - leftOffset,
                    top: droppingPosition.top - topOffset,
                },
            });
        } else if (
            itemProps.i === this.state.activeDrag?.i ||
            itemProps.i === this._savesActiveDragId
        ) {
            const dragStyles = DRAGGING_PLACEHOLDER_STYLE;

            return React.cloneElement(gridItem, {
                style: itemProps.style ? {...itemProps.style, ...dragStyles} : dragStyles,
            });
        }

        return gridItem;
    }
}

// eslint-disable-next-line new-cap
export const Layout = WidthProvider(DragOverLayout);
