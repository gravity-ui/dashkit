import React from 'react';

import ReactGridLayout, {WidthProvider} from 'react-grid-layout';

import {OVERLAY_CLASS_NAME} from '../../constants';

class DragOverLayout extends ReactGridLayout {
    componentDidMount() {
        super.componentDidMount?.();

        window.addEventListener('dragend', this.dragReset);
    }

    componentWillUnmount() {
        window.removeEventListener('dragend', this.dragReset);
    }

    dragReset = () => {
        if (this.dragEnterCounter) {
            this.dragEnterCounter = 0;
            this.removeDroppingPlaceholder();
        }
    };

    processGridItem(child, isDroppingItem) {
        const gridItem = super.processGridItem?.(child, isDroppingItem);

        if (isDroppingItem) {
            // Drop item from outside gets 0,0 droppingPosition
            // centering cursor on newly creted grid item
            // And cause grid-layout using it's own GridItem to make it look
            // like overlay adding className
            if (!gridItem) return null;

            const {props} = gridItem;
            const {containerWidth, cols, w, h, rowHeight, margin, transformScale} = props;

            const leftOffset = (((containerWidth / cols) * w) / 2 || 0) * transformScale;
            const topOffset = ((h * rowHeight + (h - 1) * margin[1]) / 2 || 0) * transformScale;

            return React.cloneElement(gridItem, {
                className: OVERLAY_CLASS_NAME,
                droppingPosition: {
                    ...props.droppingPosition,
                    left: props.droppingPosition.left - leftOffset,
                    top: props.droppingPosition.top - topOffset,
                },
            });
        }

        return gridItem;
    }
}

// eslint-disable-next-line new-cap
export const Layout = WidthProvider(DragOverLayout);
