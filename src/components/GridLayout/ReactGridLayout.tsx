import React from 'react';

import type {Layout as RGLLayout} from 'react-grid-layout';
// @ts-expect-error - utils is not exported in type definitions
import ReactGridLayout, {WidthProvider, utils} from 'react-grid-layout';

import {DROPPING_ELEMENT_CLASS_NAME, OVERLAY_CLASS_NAME} from '../../constants';

const isRefObject = (
    value: React.Ref<HTMLDivElement>,
): value is React.RefObject<HTMLDivElement> => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'current' in value &&
        typeof value.current === 'object'
    );
};

type SharedDragPosition = {
    offsetX: number;
    offsetY: number;
};

type DragOverLayoutProps = ReactGridLayout.ReactGridLayoutProps & {
    innerRef?: React.Ref<HTMLDivElement>;
    isDragCaptured?: boolean;
    hasSharedDragItem?: boolean;
    sharedDragPosition?: SharedDragPosition;
    onDragTargetRestore?: () => void;
};

type DragOverLayoutState = {
    layout: RGLLayout[];
    activeDrag: RGLLayout | null;
};

type RGLLayoutWithPlaceholder = RGLLayout & {placeholder?: boolean};

type OnDragMethod = (
    i: string,
    x: number,
    y: number,
    sintEv: {e: Event; node: HTMLElement},
) => void;

class DragOverLayout extends ReactGridLayout {
    // @ts-expect-error - TypeScript doesn't allow direct property redeclaration in extending classes. We need to narrow the props type from ReactGridLayoutProps to DragOverLayoutProps for type safety in our custom methods
    props: DragOverLayoutProps;
    // @ts-expect-error - TypeScript doesn't allow direct property redeclaration in extending classes. State is initialized by parent constructor
    state: DragOverLayoutState;

    parentOnDrag: OnDragMethod;
    parentOnDragStop: OnDragMethod;
    _savedDraggedOutLayout: RGLLayout[] | null = null;

    constructor(props: DragOverLayoutProps, context?: unknown) {
        super(props, context);

        // @ts-expect-error - onDrag is a protected method in parent class
        this.parentOnDrag = this.onDrag;
        // @ts-expect-error - assigning custom method to parent's onDrag
        this.onDrag = this.extendedOnDrag;

        // @ts-expect-error - onDragStop is a protected method in parent class
        this.parentOnDragStop = this.onDragStop;
        // @ts-expect-error - assigning custom method to parent's onDragStop
        this.onDragStop = this.extendedOnDragStop;
    }

    componentDidMount(): void {
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

    componentWillUnmount(): void {
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
    containerHeight(): string | undefined {
        if (this.props.autoSize && this.state.layout.length === 0) {
            return;
        }

        // eslint-disable-next-line consistent-return
        // @ts-expect-error - containerHeight is a protected method in parent class
        return super.containerHeight();
    }

    // innerRef is passed by WithProvider without this wrapper there are only
    // * findDOMNode - deprecated
    // * rewrite whole ReactGridLayout.render method
    // so in that case don't try to use this class on it's own
    // or pass innerRef: React.MutableRef as it's not optional prop
    getInnerElement(): HTMLDivElement | null {
        const {innerRef} = this.props;

        return innerRef && isRefObject(innerRef) && innerRef.current ? innerRef.current : null;
    }

    // Reset placeholder when item dragged from outside
    resetExternalPlaceholder = (): void => {
        // @ts-expect-error - dragEnterCounter is an internal property of parent class
        if (this.dragEnterCounter) {
            // @ts-expect-error - dragEnterCounter is an internal property of parent class
            this.dragEnterCounter = 0;
            // @ts-expect-error - removeDroppingPlaceholder is a protected method in parent class
            this.removeDroppingPlaceholder();
        }
    };

    // Hide placeholder when element is dragged out
    hideLocalPlaceholder = (i: string): RGLLayout[] => {
        const {layout} = this.state;
        const {cols} = this.props;
        const savedLayout = layout.map((item) => ({...item}));

        let hiddenElement: RGLLayout | undefined;
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

    extendedOnDrag = (
        i: string,
        x: number,
        y: number,
        sintEv: {e: Event; node: HTMLElement},
    ): void => {
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

    extendedOnDragStop = (
        i: string,
        x: number,
        y: number,
        sintEv: {e: Event; node: HTMLElement},
    ): void => {
        // Restoring layout if item was dropped outside of the grid
        if (this._savedDraggedOutLayout) {
            const savedLayout = this._savedDraggedOutLayout;
            const l = utils.getLayoutItem(savedLayout, i);

            // Create placeholder (display only)
            const placeholder: RGLLayoutWithPlaceholder = {
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
    mouseEnterHandler = (e: MouseEvent): void => {
        if (this.props.hasSharedDragItem) {
            // @ts-expect-error - onDragEnter is a protected method in parent class
            this.onDragEnter(e);
        } else if (this.props.isDragCaptured) {
            this.props.onDragTargetRestore?.();
        }
    };

    mouseLeaveHandler = (e: MouseEvent): void => {
        if (this.props.hasSharedDragItem) {
            // @ts-expect-error - onDragLeave is a protected method in parent class
            this.onDragLeave(e);
            this.props.onDragTargetRestore?.();
        }
    };

    mouseMoveHandler = (e: MouseEvent): void => {
        if (this.props.hasSharedDragItem) {
            if (!(e as MouseEvent & {nativeEvent?: MouseEvent}).nativeEvent) {
                // Emulate nativeEvent for firefox
                const target = this.getInnerElement() || (e.target as HTMLElement);

                (e as MouseEvent & {nativeEvent: Partial<MouseEvent>}).nativeEvent = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    target,
                };
            }

            // @ts-expect-error - onDragOver is a protected method in parent class
            this.onDragOver(e);
        }
    };

    mouseUpHandler = (e: MouseEvent): void => {
        if (this.props.hasSharedDragItem) {
            e.preventDefault();
            const {droppingItem} = this.props;
            const {layout} = this.state;
            const item = layout.find((l) => l.i === droppingItem?.i);

            // reset dragEnter counter on drop
            this.resetExternalPlaceholder();

            if (item) {
                this.props.onDrop?.(layout, item, e);
            }
        }
    };

    calculateDroppingPosition(itemProps: {
        containerWidth: number;
        cols: number;
        w: number;
        h: number;
        rowHeight: number;
        margin: [number, number];
        transformScale: number;
        droppingPosition: {left: number; top: number};
    }): {left: number; top: number} {
        const {containerWidth, cols, w, h, rowHeight, margin, transformScale, droppingPosition} =
            itemProps;
        const {sharedDragPosition} = this.props;

        let offsetX: number, offsetY: number;

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
    processGridItem(
        child: React.ReactElement,
        isDroppingItem?: boolean,
    ): React.ReactElement | undefined {
        // @ts-expect-error - processGridItem is a protected method in parent class
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
export const Layout = WidthProvider<DragOverLayoutProps>(DragOverLayout);
