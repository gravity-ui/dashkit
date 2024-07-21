import React from 'react';

import ReactGridLayout, {WidthProvider, utils} from 'react-grid-layout';

import {OVERLAY_CLASS_NAME} from '../../constants';

const {compact, compactType} = utils;

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
    }

    containerHeight() {
        // Resetting height when last element removed
        if (this.props.autoSize && this.state.layout.length === 0) {
            return 'unset';
        }

        return super.containerHeight();
    }

    getInnerElement() {
        // innerRef is passed by WithProvider
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
                this.placeholderLocalReset(i);
                this._isExited = true;
                this.props.onDragExit?.();
            }

            return;
        }

        this._isExited = false;

        this.parentOnDrag(i, x, y, sintEv);
    };

    extendedOnDragStop = (i, x, y, sintEv) => {
        if (this._isExited && this._savedLayout) {
            // Restoring layout
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

            this.setState(
                {
                    layout: this._savedLayout,
                    activeDrag: placeholder,
                },
                () => {
                    this._savesActiveDragId = null;
                    this.parentOnDragStop(i, x, y, sintEv);
                    this._savedLayout = null;
                },
            );
        } else {
            this._savesActiveDragId = null;
            this.parentOnDragStop(i, x, y, sintEv);
        }

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
            // this.removeDroppingPlaceholder();
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

    resetExternalPlaceholder = () => {
        if (this.dragEnterCounter) {
            this.dragEnterCounter = 0;
            this.removeDroppingPlaceholder();
        }
    };

    placeholderLocalReset = (i) => {
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
        const {props} = gridItem;

        if (isDroppingItem) {
            const {containerWidth, cols, w, h, rowHeight, margin, transformScale} = props;

            const leftOffset = (((containerWidth / cols) * w) / 2 || 0) * transformScale;
            const topOffset = ((h * rowHeight + (h - 1) * margin[1]) / 2 || 0) * transformScale;
            const dragStyles = this.props.sourceGroup
                ? // Hiding duplicate placeholder
                  {opacity: 0, pointerEvents: 'none'}
                : {pointerEvents: 'none'};

            return React.cloneElement(gridItem, {
                style: props.style ? {...props.style, ...dragStyles} : dragStyles,
                className: OVERLAY_CLASS_NAME,
                droppingPosition: {
                    ...props.droppingPosition,
                    left: props.droppingPosition.left - leftOffset,
                    top: props.droppingPosition.top - topOffset,
                },
            });
        } else if (props.i === this.state.activeDrag?.i || props.i === this._savesActiveDragId) {
            const dragStyles = {pointerEvents: 'none'};
            return React.cloneElement(gridItem, {
                style: props.style ? {...props.style, ...dragStyles} : dragStyles,
            });
        }

        return gridItem;
    }
}

// eslint-disable-next-line new-cap
export const Layout = WidthProvider(DragOverLayout);
