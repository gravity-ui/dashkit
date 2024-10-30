import React from 'react';

import ReactGridLayout, {WidthProvider, utils} from 'react-grid-layout';

import {DROPPING_ELEMENT_CLASS_NAME, OVERLAY_CLASS_NAME} from '../../constants';

class DragOverLayout extends ReactGridLayout {
    constructor(...args) {
        super(...args);

        this.parentOnDrag = this.onDrag;
        this.onDrag = this.extendedOnDrag;

        this.parentOnDragStop = this.onDragStop;
        this.onDragStop = this.extendedOnDragStop;
    }

    _savedDraggedOutLayout = null;

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
    }

    // react-grid-layout doens't calculate it's height when last element is removed
    // and just keeps the previous value
    // so for autosize to work in that case we are resetting it's height value
    containerHeight() {
        if (this.props.autoSize && this.state.layout.length === 0) {
            return;
        }

        // eslint-disable-next-line consistent-return
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
        const savedLayout = layout.map((item) => ({...item}));

        let hiddenElement;
        const newLayout = utils.compact(
            layout.filter((item) => {
                if (item.i === i) {
                    hiddenElement = item;
                    return false;
                }

                return true;
            }),
            utils.compactType(this.props),
            cols,
        );

        if (hiddenElement) {
            newLayout.push(hiddenElement);
        }

        this.setState({
            activeDrag: null,
            layout: newLayout,
        });

        return savedLayout;
    };

    extendedOnDrag = (i, x, y, sintEv) => {
        if (this.props.isDragCaptured) {
            if (!this._savedDraggedOutLayout) {
                this._savedDraggedOutLayout = this.hideLocalPlaceholder(i);
            }

            return;
        }

        this._savedDraggedOutLayout = null;
        // parent onDrag will show new placeholder again
        this.parentOnDrag(i, x, y, sintEv);
    };

    extendedOnDragStop = (i, x, y, sintEv) => {
        // Restoring layout if item was dropped outside of the grid
        if (this._savedDraggedOutLayout) {
            const savedLayout = this._savedDraggedOutLayout;
            const l = utils.getLayoutItem(savedLayout, i);

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
                    layout: savedLayout,
                    activeDrag: placeholder,
                },
                () => {
                    this.parentOnDragStop(i, x, y, sintEv);
                },
            );

            this._savedDraggedOutLayout = null;
        } else {
            this.parentOnDragStop(i, x, y, sintEv);
        }
    };

    // Proxy mouse events -> drag methods for dnd between groups
    mouseEnterHandler = (e) => {
        if (this.props.hasSharedDragItem) {
            this.onDragEnter(e);
        } else if (this.props.isDragCaptured) {
            this.props.onDragTargetRestore?.();
        }
    };

    mouseLeaveHandler = (e) => {
        if (this.props.hasSharedDragItem) {
            this.onDragLeave(e);
            this.props.onDragTargetRestore?.();
        }
    };

    mouseMoveHandler = (e) => {
        if (this.props.hasSharedDragItem) {
            this.onDragOver(e);
        }
    };

    mouseUpHandler = (e) => {
        if (this.props.hasSharedDragItem) {
            e.preventDefault();
            const {droppingItem} = this.props;
            const {layout} = this.state;
            const item = layout.find((l) => l.i === droppingItem.i);

            // reset dragEnter counter on drop
            this.resetExternalPlaceholder();

            this.props.onDrop?.(layout, item, e);
        }
    };

    calculateDroppingPosition(itemProps) {
        const {containerWidth, cols, w, h, rowHeight, margin, transformScale, droppingPosition} =
            itemProps;
        const {sharedDragPosition} = this.props;

        let offsetX, offsetY;

        if (sharedDragPosition) {
            offsetX = sharedDragPosition.offsetX;
            offsetY = sharedDragPosition.offsetY;
        } else {
            offsetX = (((containerWidth / cols) * w) / 2 || 0) * transformScale;
            offsetY = ((h * rowHeight + (h - 1) * margin[1]) / 2 || 0) * transformScale;
        }

        return {
            ...droppingPosition,
            left: droppingPosition.left - offsetX,
            top: droppingPosition.top - offsetY,
        };
    }

    // Drop item from outside gets 0,0 droppingPosition
    // centering cursor on newly creted grid item
    // And cause grid-layout using it's own GridItem to make it look
    // like overlay adding className
    processGridItem(child, isDroppingItem) {
        const gridItem = super.processGridItem?.(child, isDroppingItem);

        if (!gridItem) {
            return gridItem;
        }

        if (isDroppingItem) {
            // React.cloneElement is just cleaner then copy-paste whole processGridItem method
            return React.cloneElement(gridItem, {
                // hiding preview if dragging shared item
                style: this.props.hasSharedDragItem
                    ? {...gridItem.props.style, opacity: 0}
                    : gridItem.props.style,
                className: `${OVERLAY_CLASS_NAME} ${DROPPING_ELEMENT_CLASS_NAME}`,
                droppingPosition: this.calculateDroppingPosition(gridItem.props),
            });
        }

        return gridItem;
    }
}

// eslint-disable-next-line new-cap
export const Layout = WidthProvider(DragOverLayout);
