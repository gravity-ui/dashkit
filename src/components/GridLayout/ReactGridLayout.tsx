import React from 'react';

import {flushSync} from 'react-dom';
import type {Layout as RGLLayout} from 'react-grid-layout';
// @ts-expect-error - utils is not exported in type definitions
import ReactGridLayout, {utils} from 'react-grid-layout';
import ResizeObserverPolyfill from 'resize-observer-polyfill';

import {DROPPING_ELEMENT_CLASS_NAME, OVERLAY_CLASS_NAME} from '../../constants';

const GRID_LAYOUT_CLASS_NAME = 'react-grid-layout';

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
    dragStateRef?: React.MutableRefObject<{isDragging: boolean; sourceGroup: string | null}>;
    sharedDragPositionRef?: React.MutableRefObject<SharedDragPosition | null>;
    group?: string;
    onDragTargetRestore?: () => void;
    transformScaleRef?: React.MutableRefObject<number>;
    groupResetRegistryRef?: React.MutableRefObject<Map<string, () => void>>;
    externalLayoutRevision?: number;
};

type DragOverLayoutState = {
    layout: RGLLayout[];
    activeDrag: RGLLayout | null;
};

type RGLLayoutWithPlaceholder = RGLLayout & {placeholder?: boolean};

type PassiveWidthProviderProps = DragOverLayoutProps & {
    measureBeforeMount?: boolean;
};

type OnDragMethod = (
    i: string,
    x: number,
    y: number,
    sintEv: {e: Event; node: HTMLElement},
) => void;

const getGridItemStyle = ({
    cols,
    containerPadding,
    margin,
    width,
    x,
    y,
    w,
    h,
    rowHeight,
    useCSSTransforms,
}: {
    cols: number;
    containerPadding: [number, number];
    h: number;
    margin: [number, number];
    rowHeight: number;
    useCSSTransforms: boolean;
    w: number;
    width: number;
    x: number;
    y: number;
}) => {
    const [marginX, marginY] = margin;
    const [paddingX, paddingY] = containerPadding;
    const columnWidth = (width - marginX * (cols - 1) - paddingX * 2) / cols;
    const position = {
        height: Math.round(rowHeight * h + marginY * (h - 1)),
        left: Math.round((columnWidth + marginX) * x + paddingX),
        top: Math.round(paddingY + (rowHeight + marginY) * y),
        width: Math.round(columnWidth * w + marginX * (w - 1)),
    };

    return useCSSTransforms
        ? {...utils.setTransform(position), left: '', top: ''}
        : {
              ...utils.setTopLeft(position),
              MozTransform: '',
              OTransform: '',
              WebkitTransform: '',
              msTransform: '',
              transform: '',
          };
};

class DragOverLayout extends ReactGridLayout {
    // @ts-expect-error - TypeScript doesn't allow direct property redeclaration in extending classes. We need to narrow the props type from ReactGridLayoutProps to DragOverLayoutProps for type safety in our custom methods
    props: DragOverLayoutProps;
    // @ts-expect-error - TypeScript doesn't allow direct property redeclaration in extending classes. State is initialized by parent constructor
    state: DragOverLayoutState;

    parentOnDrag: OnDragMethod;
    parentOnDragStop: OnDragMethod;
    _savedDraggedOutLayout: RGLLayout[] | null = null;
    // Suppresses onLayoutMaybeChanged during imperative layout restore actions.
    // Without this flag, our setState would trigger onLayoutChange back to the consumer
    // that just initiated the action, causing a spurious 'change' event.
    _isRestoringExternalLayout = false;
    private readonly gridItemChildren = new WeakMap<
        React.ReactElement,
        {child: React.ReactElement; metadata: Record<string, string>}
    >();

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

        if (this.props.group !== undefined) {
            this.props.groupResetRegistryRef?.current.set(
                this.props.group,
                this.resetExternalPlaceholder,
            );
        }

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

    componentDidUpdate(prevProps: DragOverLayoutProps, prevState: DragOverLayoutState): void {
        const revisionChanged =
            prevProps.externalLayoutRevision !== this.props.externalLayoutRevision;

        if (revisionChanged && this.props.layout) {
            const newLayout = utils.synchronizeLayoutWithChildren(
                this.props.layout,
                this.props.children,
                this.props.cols,
                utils.compactType(this.props),
                this.props.allowOverlap,
            );

            this._isRestoringExternalLayout = true;
            // Override both layout and propsLayout so getDerivedStateFromProps
            // doesn't revert our update on the next render cycle.
            this.setState(
                {
                    layout: newLayout,
                    propsLayout: this.props.layout,
                } as unknown as DragOverLayoutState,
                () => {
                    this._isRestoringExternalLayout = false;
                },
            );
            // RGL's shouldComponentUpdate only tracks activeDrag/mounted/droppingPosition — not
            // state.layout. So setState({layout}) alone is silently ignored (no re-render).
            // forceUpdate bypasses SCU and is batched with the setState above, producing a
            // single render cycle with the merged state that includes the restored layout.
            this.forceUpdate();
            // Don't call super here: restoring is an external action, not a user drag/resize.
            // onLayoutMaybeChanged is suppressed via _isRestoringExternalLayout.
            return;
        }

        // Maintain parent behavior for all non-restore cycles (drag, resize, etc.).
        super.componentDidUpdate?.(prevProps, prevState);
    }

    onLayoutMaybeChanged(newLayout: RGLLayout[], oldLayout: RGLLayout[]): void {
        if (this._isRestoringExternalLayout) {
            return;
        }
        // @ts-expect-error — onLayoutMaybeChanged is not in ReactGridLayout's public types
        super.onLayoutMaybeChanged(newLayout, oldLayout);
    }

    componentWillUnmount(): void {
        if (this.props.group !== undefined) {
            this.props.groupResetRegistryRef?.current.delete(this.props.group);
        }

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

    isSharedDragTarget = (): boolean => {
        const drag = this.props.dragStateRef?.current;
        return Boolean(drag?.isDragging);
    };

    // Proxy mouse events -> drag methods for dnd between groups
    mouseEnterHandler = (e: MouseEvent): void => {
        if (this.isSharedDragTarget()) {
            // @ts-expect-error - onDragEnter is a protected method in parent class
            this.onDragEnter(e);
        } else if (this.props.isDragCaptured) {
            this.props.onDragTargetRestore?.();
        }
    };

    mouseLeaveHandler = (e: MouseEvent): void => {
        if (this.isSharedDragTarget()) {
            // @ts-expect-error - onDragLeave is a protected method in parent class
            this.onDragLeave(e);
            this.props.onDragTargetRestore?.();
        }
    };

    mouseMoveHandler = (e: MouseEvent): void => {
        if (
            this.isSharedDragTarget() &&
            this.props.group !== this.props.dragStateRef?.current.sourceGroup
        ) {
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
        if (this.isSharedDragTarget()) {
            e.preventDefault();
            const {droppingItem} = this.props;
            const {layout} = this.state;
            const item = layout.find((l) => l.i === droppingItem?.i);

            // reset dragEnter counter on drop for all registered groups
            this.props.groupResetRegistryRef?.current.forEach((reset) => reset());

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
        const sharedDragPosition = this.props.sharedDragPositionRef?.current;

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

        const {cols, containerPadding, h, margin, rowHeight, useCSSTransforms, w, x, y} =
            gridItem.props;
        const [marginX, marginY] = margin;
        const [paddingX, paddingY] = containerPadding;
        const gridItemMetadata: Record<string, string> = {
            'data-dashkit-grid-cols': String(cols),
            'data-dashkit-grid-h': String(h),
            'data-dashkit-grid-margin-x': String(marginX),
            'data-dashkit-grid-margin-y': String(marginY),
            'data-dashkit-grid-padding-x': String(paddingX),
            'data-dashkit-grid-padding-y': String(paddingY),
            'data-dashkit-grid-row-height': String(rowHeight),
            'data-dashkit-grid-use-css-transforms': String(useCSSTransforms),
            'data-dashkit-grid-w': String(w),
            'data-dashkit-grid-x': String(x),
            'data-dashkit-grid-y': String(y),
        };
        // Lazy proxy for transformScaleRef so react-draggable reads fresh scale without re-render.
        const {transformScaleRef} = this.props;
        const lazyScale = transformScaleRef
            ? ({valueOf: () => transformScaleRef.current} as unknown as number)
            : undefined;

        if (isDroppingItem) {
            // React.cloneElement is just cleaner then copy-paste whole processGridItem method
            return React.cloneElement(gridItem, {
                ...(lazyScale !== undefined && {transformScale: lazyScale}),
                // hiding preview if dragging shared item
                style: this.isSharedDragTarget()
                    ? {...gridItem.props.style, opacity: 0}
                    : gridItem.props.style,
                className: `${OVERLAY_CLASS_NAME} ${DROPPING_ELEMENT_CLASS_NAME}`,
                droppingPosition: this.calculateDroppingPosition(gridItem.props),
            });
        }

        const gridChild = gridItem.props.children as React.ReactElement<Record<string, string>>;
        const cachedGridItemChild = this.gridItemChildren.get(gridChild);
        const gridItemChild =
            cachedGridItemChild &&
            Object.keys(gridItemMetadata).every(
                (key) => cachedGridItemChild.metadata[key] === gridItemMetadata[key],
            )
                ? cachedGridItemChild.child
                : React.cloneElement(gridChild, gridItemMetadata);

        if (gridItemChild !== cachedGridItemChild?.child) {
            this.gridItemChildren.set(gridChild, {
                child: gridItemChild,
                metadata: gridItemMetadata,
            });
        }

        if (lazyScale !== undefined) {
            return React.cloneElement(gridItem, {
                children: gridItemChild,
                transformScale: lazyScale,
            });
        }

        return React.cloneElement(gridItem, {children: gridItemChild});
    }
}

class PassiveWidthProvider extends React.Component<
    PassiveWidthProviderProps,
    {interactionRevision: number; isMounted: boolean; settledWidth: number}
> {
    state = {interactionRevision: 0, isMounted: false, settledWidth: 1280};

    private element: HTMLDivElement | null = null;
    private readonly elementRef = React.createRef<HTMLDivElement>();
    private readonly widthRef = {current: 1280};
    private gridItems: HTMLElement[] = [];
    private lastAppliedWidth?: number;
    private resizeObserver?: ResizeObserver;
    private settledWidthCommitFrame?: number;
    private isComponentMounted = false;

    componentDidMount() {
        this.isComponentMounted = true;
        this.syncElement();
        this.setState({isMounted: true, settledWidth: this.widthRef.current});
    }

    componentDidUpdate() {
        this.syncElement();
        this.cacheGridItems();
        this.updateGridItems(this.widthRef.current);
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        if (this.settledWidthCommitFrame !== undefined) {
            window.cancelAnimationFrame(this.settledWidthCommitFrame);
            this.settledWidthCommitFrame = undefined;
        }
        this.element?.removeEventListener('pointerdown', this.handlePointerDown, true);
        this.element = null;
    }

    render() {
        const {measureBeforeMount, ...props} = this.props;

        if (measureBeforeMount && !this.state.isMounted) {
            return (
                <div
                    className={[props.className, GRID_LAYOUT_CLASS_NAME].filter(Boolean).join(' ')}
                    ref={this.elementRef}
                    style={props.style}
                />
            );
        }

        return (
            <DragOverLayout {...props} innerRef={this.elementRef} width={this.state.settledWidth} />
        );
    }

    private cacheGridItems = () => {
        const node = this.element;
        this.gridItems = node
            ? Array.from(node.children).filter(
                  (child): child is HTMLElement =>
                      child instanceof HTMLElement &&
                      child.matches('.react-grid-item[data-dashkit-grid-cols]'),
              )
            : [];
        this.lastAppliedWidth = undefined;
    };

    private updateGridItems = (width: number) => {
        if (width === this.lastAppliedWidth) {
            return;
        }
        this.lastAppliedWidth = width;

        this.gridItems.forEach((item) => {
            if (
                item.classList.contains('react-draggable-dragging') ||
                item.classList.contains('resizing')
            ) {
                return;
            }

            const {dataset, style} = item;
            const cols = Number(dataset.dashkitGridCols);
            const x = Number(dataset.dashkitGridX);
            const y = Number(dataset.dashkitGridY);
            const w = Number(dataset.dashkitGridW);
            const h = Number(dataset.dashkitGridH);
            const marginX = Number(dataset.dashkitGridMarginX);
            const marginY = Number(dataset.dashkitGridMarginY);
            const paddingX = Number(dataset.dashkitGridPaddingX);
            const paddingY = Number(dataset.dashkitGridPaddingY);
            const rowHeight = Number(dataset.dashkitGridRowHeight);
            const useCSSTransforms = dataset.dashkitGridUseCssTransforms === 'true';

            if (
                [cols, x, y, w, h, marginX, marginY, paddingX, paddingY, rowHeight].some(
                    (value) => !Number.isFinite(value),
                )
            ) {
                return;
            }

            Object.assign(
                style,
                getGridItemStyle({
                    cols,
                    containerPadding: [paddingX, paddingY],
                    h,
                    margin: [marginX, marginY],
                    rowHeight,
                    useCSSTransforms,
                    w,
                    width,
                    x,
                    y,
                }),
            );
        });
    };

    private handlePointerDown = () => {
        if (!this.props.isDraggable && !this.props.isResizable) {
            return;
        }

        flushSync(() => {
            this.setState((state) => ({
                interactionRevision: state.interactionRevision + 1,
                settledWidth: this.widthRef.current,
            }));
        });
    };

    private scheduleSettledWidthCommit = () => {
        if (this.settledWidthCommitFrame !== undefined) {
            window.cancelAnimationFrame(this.settledWidthCommitFrame);
        }
        this.settledWidthCommitFrame = window.requestAnimationFrame(() => {
            this.settledWidthCommitFrame = window.requestAnimationFrame(() => {
                this.settledWidthCommitFrame = undefined;
                if (this.state.settledWidth !== this.widthRef.current) {
                    this.setState({settledWidth: this.widthRef.current});
                }
            });
        });
    };

    private syncElement = () => {
        const node = this.elementRef.current;
        if (node === this.element) {
            return;
        }

        if (this.element) {
            this.resizeObserver?.unobserve(this.element);
            this.element.removeEventListener('pointerdown', this.handlePointerDown, true);
        }

        this.element = node;
        if (node && this.isComponentMounted) {
            this.observeElement(node);
        }
    };

    private observeElement = (node: HTMLDivElement) => {
        this.widthRef.current = node.clientWidth;
        this.cacheGridItems();
        this.updateGridItems(this.widthRef.current);
        node.addEventListener('pointerdown', this.handlePointerDown, true);
        this.resizeObserver ??= new (
            typeof ResizeObserver === 'function' ? ResizeObserver : ResizeObserverPolyfill
        )((entries: ResizeObserverEntry[]) => {
            const entry = entries.find((currentEntry) => currentEntry.target === this.element);
            if (!entry) {
                return;
            }

            this.widthRef.current = entry.contentRect.width;
            this.updateGridItems(this.widthRef.current);
            this.scheduleSettledWidthCommit();
        });
        this.resizeObserver.observe(node);
    };
}

export const Layout = PassiveWidthProvider;
