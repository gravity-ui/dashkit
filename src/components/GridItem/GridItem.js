import React from 'react';

import PropTypes from 'prop-types';

import {DashKitContext} from '../../context/DashKitContext';
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
    async getFocuseState() {
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
        id: PropTypes.string,
        item: PropTypes.object,
        isDragging: PropTypes.bool,
        layout: PropTypes.array,
        overlayControls: PropTypes.object,

        forwardedRef: PropTypes.any,
        forwardedPluginRef: PropTypes.any,
        isPlaceholder: PropTypes.bool,

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
    };

    static contextType = DashKitContext;

    state = {
        isFocused: false,
    };

    renderOverlay() {
        const {overlayControls} = this.props;
        const {editMode} = this.context;

        if (!editMode || this.props.item.data._editActive) {
            return null;
        }

        const {item} = this.props;
        const controls = overlayControls && overlayControls[item.type];

        return (
            <React.Fragment>
                <div className={b('overlay')} />
                <OverlayControls
                    configItem={item}
                    items={controls}
                    overlayControls={overlayControls}
                />
            </React.Fragment>
        );
    }

    onFocusHandler = () => {
        this.setState({isFocused: true});

        if (this.controller) {
            this.controller.abort();
        }
    };

    onBlurHandler = () => {
        this.controller = new AbortController();

        windowFocusObserver.getFocuseState().then((isWindowFocused) => {
            if (!this.controller.signal.aborted && isWindowFocused) {
                this.setState({isFocused: false});
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
            noOverlay,
            focusable,
            withCustomHandle,
            isPlaceholder,
        } = this.props;
        const {editMode} = this.context;
        const width = Number.parseInt(style.width, 10);
        const height = Number.parseInt(style.height, 10);
        const transform = style.transform;
        const preparedClassName = editMode
            ? className
            : className.replace('react-resizable', '').replace('react-draggable', '');
        const preparedChildren = editMode ? children : null;
        const reactGridLayoutProps = editMode
            ? {onMouseDown, onMouseUp, onTouchEnd, onTouchStart}
            : {};
        const {_editActive} = this.props.item.data;
        return (
            <div
                className={b(
                    {
                        'is-dragging': isDragging,
                        'is-focused': this.state.isFocused,
                        'with-custom-handle': withCustomHandle,
                    },
                    preparedClassName,
                )}
                data-qa="dashkit-grid-item"
                style={style}
                ref={this.props.forwardedRef}
                {...reactGridLayoutProps}
                {...(focusable
                    ? {
                          onFocus: this.onFocusHandler,
                          onBlur: this.onBlurHandler,
                          tabIndex: -1,
                      }
                    : {})}
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
