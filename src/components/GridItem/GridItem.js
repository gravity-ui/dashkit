import React from 'react';
import PropTypes from 'prop-types';
import {CSSTransition} from 'react-transition-group';

import Item from '../Item/Item';
import {DashKitContext} from '../../context/DashKitContext';
import {cn} from '../../utils/cn';

import './GridItem.scss';

import OverlayControls from '../OverlayControls/OverlayControls';

const b = cn('dashkit-grid-item');

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

        // from react-grid-layout:
        children: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
        noOverlay: PropTypes.bool,
        withCustomHandle: PropTypes.bool,
        onMouseDown: PropTypes.func,
        onMouseUp: PropTypes.func,
        onTouchEnd: PropTypes.func,
        onTouchStart: PropTypes.func,
    };

    static contextType = DashKitContext;

    overlayRef = React.createRef(null);
    controlsRef = React.createRef();

    renderOverlay() {
        const {overlayControls} = this.props;
        const {editMode} = this.context;
        const isHidden = !editMode || this.props.item.data._editActive;

        const {item} = this.props;
        const controls = overlayControls && overlayControls[item.type];

        return (
            <>
                <CSSTransition
                    in={!isHidden}
                    nodeRef={this.overlayRef}
                    classNames={b('overlay')}
                    timeout={500}
                    unmountOnExit
                >
                    <div ref={this.overlayRef} className={b('overlay')} />
                </CSSTransition>
                <CSSTransition
                    in={!isHidden}
                    nodeRef={this.controlsRef}
                    classNames={b('controls')}
                    timeout={500}
                    unmountOnExit
                >
                    <OverlayControls
                        configItem={item}
                        items={controls}
                        overlayControls={overlayControls}
                        forwardRef={this.controlsRef}
                    />
                </CSSTransition>
            </>
        );
    }

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
            withCustomHandle,
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
                        'with-custom-handle': withCustomHandle,
                    },
                    preparedClassName,
                )}
                data-qa="dashkit-grid-item"
                style={style}
                ref={this.props.forwardedRef}
                {...reactGridLayoutProps}
            >
                <div className={b('item', {editMode: editMode && !_editActive && !noOverlay})}>
                    <Item
                        id={this.props.id}
                        item={this.props.item}
                        shouldItemUpdate={!isDragging}
                        width={width}
                        height={height}
                        transform={transform}
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

export default React.forwardRef((props, ref) => {
    return <GridItem {...props} forwardedRef={ref} />;
});
