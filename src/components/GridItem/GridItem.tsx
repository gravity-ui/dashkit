import React from 'react';

import {FOCUSED_CLASS_NAME} from '../../constants';
import {DashKitContext} from '../../context';
import type {ConfigItem, ConfigLayout} from '../../shared';
import type {PluginRef, ReactGridLayoutProps} from '../../typings';
import {cn} from '../../utils/cn';
import Item from '../Item/Item';
import OverlayControls from '../OverlayControls/OverlayControls';

import './GridItem.scss';

const b = cn('dashkit-grid-item');

class WindowFocusObserver {
    subscribers = 0;
    isFocused = !document.hidden;

    constructor() {
        window.addEventListener('blur', this.blurHandler, true);
        window.addEventListener('focus', this.focusHandler, true);
    }

    blurHandler = (e: FocusEvent) => {
        if (e.target === window) {
            this.isFocused = false;
        }
    };

    focusHandler = (e: FocusEvent) => {
        if (e.target === window) {
            this.isFocused = true;
        }
    };

    // Method to get state after all blur\focus events in document are triggered
    async getFocusedState(): Promise<boolean> {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                resolve(this.isFocused);
            });
        });
    }
}

const windowFocusObserver = new WindowFocusObserver();

type GridItemProps = {
    adjustWidgetLayout: (data: {
        widgetId: string;
        needSetDefault?: boolean;
        adjustedWidgetLayout?: ConfigLayout;
    }) => void;
    gridLayout?: ReactGridLayoutProps;
    id?: string;
    item: ConfigItem;
    isDragging?: boolean;
    isDraggedOut?: boolean;
    layout?: ConfigLayout[];

    forwardedRef?: React.Ref<HTMLDivElement>;
    forwardedPluginRef?: (pluginRef: PluginRef) => void;
    isPlaceholder?: boolean;

    onItemMountChange?: (item: ConfigItem, meta: {isAsync: boolean; isMounted: boolean}) => void;
    onItemRender?: (item: ConfigItem) => void;

    // from react-grid-layout:
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    noOverlay?: boolean;
    focusable?: boolean;
    withCustomHandle?: boolean;
    onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
    onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
    onItemFocus?: (item: ConfigItem) => void;
    onItemBlur?: (item: ConfigItem) => void;
};

type GridItemState = {
    isFocused: boolean;
};

class GridItem extends React.PureComponent<GridItemProps, GridItemState> {
    static contextType = DashKitContext;
    context!: React.ContextType<typeof DashKitContext>;

    _isAsyncItem = false;
    controller: AbortController | null = null;

    state: GridItemState = {
        isFocused: false,
    };

    renderOverlay() {
        const {isPlaceholder} = this.props;
        const {editMode} = this.context;

        if (editMode && this.props.item.data._editActive) {
            // needed for correst pointer-events: none work in firefox
            return <div className={b('overlay-placeholder')} />;
        }

        if (!editMode || this.props.item.data._editActive || isPlaceholder) {
            return null;
        }

        const {item, focusable} = this.props;

        return (
            <React.Fragment>
                <div className={b('overlay')} />
                <OverlayControls
                    configItem={item}
                    onItemClick={focusable ? this.onOverlayItemClick : undefined}
                />
            </React.Fragment>
        );
    }

    onOverlayItemClick = () => {
        // Creating button element to trigger focus out
        const focusDummy = document.createElement('button');
        Object.assign(focusDummy.style, {
            width: '0',
            height: '0',
            opacity: '0',
            position: 'fixed',
            top: '0',
            left: '0',
        });

        // requestAnimationFrame to make call after alert() or confirm()
        requestAnimationFrame(() => {
            // Adding elment an changing focus
            document.body.appendChild(focusDummy);
            focusDummy.focus();
            document.body.removeChild(focusDummy);

            this.setState({isFocused: false});
        });
    };

    onFocusHandler = () => {
        this.setState({isFocused: true});

        if (this.props.onItemFocus) {
            // Sync focus and blur handlers
            windowFocusObserver.getFocusedState().then(() => {
                this.props.onItemFocus?.(this.props.item);
            });
        }

        if (this.controller) {
            this.controller.abort();
        }
    };

    onBlurHandler = () => {
        this.controller = new AbortController();

        windowFocusObserver.getFocusedState().then((isWindowFocused) => {
            if (!this.controller?.signal.aborted && isWindowFocused) {
                this.setState({isFocused: false});
                this.props.onItemBlur?.(this.props.item);
            }

            this.controller = null;
        });
    };

    render() {
        // из-за бага, что Grid Items unmounts при изменении static, isDraggable, isResaizable
        // https://github.com/STRML/react-grid-layout/issues/721
        const {
            style,
            onMouseDown,
            onMouseUp,
            onTouchEnd,
            onTouchStart,
            children,
            className,
            isDragging,
            isDraggedOut,
            noOverlay,
            focusable,
            withCustomHandle,
            isPlaceholder = false,
        } = this.props;
        const {editMode} = this.context;
        const {isFocused} = this.state;

        const width =
            style?.width === undefined ? undefined : Number.parseInt(String(style.width), 10);
        const height =
            style?.height === undefined ? undefined : Number.parseInt(String(style.height), 10);
        const transform = style?.transform;
        const preparedClassName =
            (editMode
                ? className
                : className
                      ?.replace('react-resizable', '')
                      .replace('react-draggable', '')
                      .replace(FOCUSED_CLASS_NAME, '')) +
            (isFocused ? ` ${FOCUSED_CLASS_NAME}` : '');
        const computedClassName = b(
            {
                'is-dragging': isDragging,
                'is-dragged-out': isDraggedOut,
                'is-focused': isFocused,
                'with-custom-handle': withCustomHandle,
            },
            preparedClassName,
        );

        const preparedChildren = editMode ? children : null;
        const reactGridLayoutProps = editMode
            ? {onMouseDown, onMouseUp, onTouchEnd, onTouchStart}
            : {};
        const reactFocusProps = focusable
            ? {
                  onFocus: this.onFocusHandler,
                  onBlur: this.onBlurHandler,
                  tabIndex: -1,
              }
            : {};
        const {_editActive} = this.props.item.data;

        return (
            <div
                className={computedClassName}
                data-qa="dashkit-grid-item"
                style={style}
                ref={this.props.forwardedRef}
                {...reactGridLayoutProps}
                {...reactFocusProps}
            >
                <div className={b('item', {editMode: editMode && !_editActive && !noOverlay})}>
                    <Item
                        id={this.props.id}
                        item={this.props.item}
                        shouldItemUpdate={!isDragging}
                        width={width}
                        height={height}
                        transform={transform}
                        isPlaceholder={isPlaceholder}
                        adjustWidgetLayout={this.props.adjustWidgetLayout}
                        layout={this.props.layout}
                        forwardedPluginRef={this.props.forwardedPluginRef}
                        onItemMountChange={this.props.onItemMountChange}
                        onItemRender={this.props.onItemRender}
                        gridLayout={this.props.gridLayout}
                    />
                </div>
                {!noOverlay && this.renderOverlay()}
                {preparedChildren}
            </div>
        );
    }
}

const GridItemForwarderRef = React.forwardRef<HTMLDivElement, Omit<GridItemProps, 'forwardedRef'>>(
    (props, ref) => {
        return <GridItem {...props} forwardedRef={ref} />;
    },
);

GridItemForwarderRef.displayName = 'forwardRef(GridItem)';

export default GridItemForwarderRef;
