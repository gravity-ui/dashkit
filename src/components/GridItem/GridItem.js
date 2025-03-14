import React from 'react';

import PropTypes from 'prop-types';

import {FOCUSED_CLASS_NAME} from '../../constants';
import {DashKitContext} from '../../context';
import {cn} from '../../utils/cn';
import Item from '../Item/Item';
import OverlayControls from '../OverlayControls/OverlayControls';

import './GridItem.scss';

const b = cn('dashkit-grid-item');

class WindowFocusObserver {
    constructor() {
        this.subscribers = 0;
        this.isFocused = !document.hidden;

        window.addEventListener('blur', this.blurHandler, true);
        window.addEventListener('focus', this.focusHandler, true);
    }

    blurHandler = (e) => {
        if (e.target === window) {
            this.isFocused = false;
        }
    };

    focusHandler = (e) => {
        if (e.target === window) {
            this.isFocused = true;
        }
    };

    // Method to get state after all blur\focus events in document are triggered
    async getFocusedState() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                resolve(this.isFocused);
            });
        });
    }
}

const windowFocusObserver = new WindowFocusObserver();

class GridItem extends React.PureComponent {
    static propTypes = {
        adjustWidgetLayout: PropTypes.func.isRequired,
        gridLayout: PropTypes.object,
        id: PropTypes.string,
        item: PropTypes.object,
        isDragging: PropTypes.bool,
        isDraggedOut: PropTypes.bool,
        layout: PropTypes.array,

        forwardedRef: PropTypes.any,
        forwardedPluginRef: PropTypes.any,
        isPlaceholder: PropTypes.bool,

        onItemMountChange: PropTypes.func,
        onItemRender: PropTypes.func,

        // from react-grid-layout:
        children: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
        noOverlay: PropTypes.bool,
        focusable: PropTypes.bool,
        withCustomHandle: PropTypes.bool,
        onMouseDown: PropTypes.func,
        onMouseUp: PropTypes.func,
        onTouchEnd: PropTypes.func,
        onTouchStart: PropTypes.func,
        onItemFocus: PropTypes.func,
        onItemBlur: PropTypes.func,
    };

    static contextType = DashKitContext;

    _isAsyncItem = false;

    state = {
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
                    onItemClick={focusable ? this.onOverlayItemClick : null}
                />
            </React.Fragment>
        );
    }

    onOverlayItemClick = () => {
        // Creating button element to trigger focus out
        const focusDummy = document.createElement('button');
        const styles = {
            width: '0',
            height: '0',
            opacity: '0',
            position: 'fixed',
            top: '0',
            left: '0',
        };

        Object.entries(styles).forEach(([key, value]) => {
            focusDummy.style[key] = value;
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

        const width = Number.parseInt(style.width, 10);
        const height = Number.parseInt(style.height, 10);
        const transform = style.transform;
        const preparedClassName =
            (editMode
                ? className
                : className
                      .replace('react-resizable', '')
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

const GridItemForwarderRef = React.forwardRef((props, ref) => {
    return <GridItem {...props} forwardedRef={ref} />;
});

GridItemForwarderRef.displayName = 'forwardRef(GridItem)';

export default GridItemForwarderRef;
