/** @jest-environment jsdom */

import React from 'react';

import {act, fireEvent, render} from '@testing-library/react';
import ReactGridLayout from 'react-grid-layout';

import type {ConfigItem} from '../../../shared';
import GridItem, {GridItem as GridItemComponent} from '../../GridItem/GridItem';
import {Layout} from '../ReactGridLayout';

jest.mock('../../Item/Item', () => ({
    __esModule: true,
    default: () => null,
}));

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

const resizeObservers: TestResizeObserver[] = [];
const mockPolyfillObservers: TestResizeObserver[] = [];
const animationFrameCallbacks = new Map<number, FrameRequestCallback>();
let animationFrameId = 0;

jest.mock('resize-observer-polyfill', () => ({
    __esModule: true,
    default: class {
        readonly callback: ResizeObserverCallback;
        disconnect = jest.fn();
        elements = new Set<Element>();

        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
            mockPolyfillObservers.push(this as unknown as TestResizeObserver);
        }

        observe = (element: Element) => {
            this.elements.add(element);
        };

        unobserve = (element: Element) => {
            this.elements.delete(element);
        };
    },
}));

class TestResizeObserver {
    readonly callback: ResizeObserverCallback;
    disconnect = jest.fn();
    elements = new Set<Element>();

    unobserve = jest.fn((element: Element) => {
        this.elements.delete(element);
    });

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObservers.push(this);
    }

    observe(element: Element) {
        this.elements.add(element);
    }
}

const emitResize = (width: number) => {
    resizeObservers.forEach((observer) => {
        observer.elements.forEach((element) => {
            observer.callback([{contentRect: {width}, target: element} as ResizeObserverEntry]);
        });
    });
};

const emitResizeFor = (element: Element, width: number) => {
    resizeObservers
        .filter((observer) => observer.elements.has(element))
        .forEach((observer) => {
            observer.callback([{contentRect: {width}, target: element} as ResizeObserverEntry]);
        });
};

const emitPolyfillResizeFor = (element: Element, width: number) => {
    mockPolyfillObservers
        .filter((observer) => observer.elements.has(element))
        .forEach((observer) => {
            observer.callback([{contentRect: {width}, target: element} as ResizeObserverEntry]);
        });
};

const runAnimationFrame = () => {
    const callbacks = Array.from(animationFrameCallbacks.values());
    animationFrameCallbacks.clear();
    callbacks.forEach((callback) => callback(0));
};

const gridItem = (
    <GridItem
        adjustWidgetLayout={jest.fn()}
        id="item"
        item={{data: {}} as ConfigItem}
        key="item"
        layout={[]}
    />
);

describe('Layout passive resize', () => {
    beforeEach(() => {
        resizeObservers.length = 0;
        mockPolyfillObservers.length = 0;
        animationFrameCallbacks.clear();
        animationFrameId = 0;
        global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
        window.requestAnimationFrame = jest.fn((callback) => {
            animationFrameId += 1;
            animationFrameCallbacks.set(animationFrameId, callback);
            return animationFrameId;
        });
        window.cancelAnimationFrame = jest.fn((frame) => {
            animationFrameCallbacks.delete(frame);
        });
    });

    test('does not render ReactGridLayout for passive container resize', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');

        const {container} = render(
            <Layout cols={12} layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]} rowHeight={100}>
                <div key="item" />
            </Layout>,
        );
        const rendersBeforeResize = renderSpy.mock.calls.length;

        act(() => {
            emitResize(900);
            fireEvent.pointerDown(container.firstElementChild as HTMLElement);
        });

        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);
        renderSpy.mockRestore();
    });

    test.each([undefined, null] as const)(
        'uses polyfill when native ResizeObserver is %p',
        (resizeObserver) => {
            global.ResizeObserver = resizeObserver as unknown as typeof ResizeObserver;
            const {container} = render(
                <Layout
                    cols={12}
                    isDraggable={false}
                    isResizable={false}
                    layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                    rowHeight={100}
                >
                    <div key="item" />
                </Layout>,
            );
            const layout = container.querySelector<HTMLElement>('.react-grid-layout');
            const item = container.querySelector<HTMLElement>('.react-grid-item');

            expect(mockPolyfillObservers[0].elements.has(layout as HTMLElement)).toBe(true);
            act(() => {
                emitPolyfillResizeFor(layout as HTMLElement, 900);
            });

            expect(item?.style.width).toBe('213px');
            expect(item?.style.transform).toBe('translate(158px,10px)');
        },
    );

    test('commits only latest width after delivery between two quiet frames', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        render(
            <Layout
                cols={12}
                isDraggable={true}
                layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );
        const rendersBeforeResize = renderSpy.mock.calls.length;

        act(() => {
            emitResize(900);
            runAnimationFrame();
            emitResize(1000);
        });

        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);
        act(() => {
            runAnimationFrame();
        });
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);
        act(() => {
            runAnimationFrame();
        });
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize + 1);
        expect((renderSpy.mock.instances.at(-1) as unknown as ReactGridLayout).props.width).toBe(
            1000,
        );
        renderSpy.mockRestore();
    });

    test('cancels second quiet frame on unmount', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const {unmount} = render(
            <Layout
                cols={12}
                isDraggable={true}
                layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );
        const rendersBeforeResize = renderSpy.mock.calls.length;

        act(() => {
            emitResize(900);
            runAnimationFrame();
        });
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);

        unmount();
        expect(window.cancelAnimationFrame).toHaveBeenLastCalledWith(2);
        act(() => {
            runAnimationFrame();
        });
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);
        renderSpy.mockRestore();
    });

    test('keeps distinct view item geometry after passive resize', () => {
        const {container} = render(
            <Layout
                cols={12}
                isDraggable={false}
                isResizable={false}
                layout={[
                    {h: 1, i: 'first', w: 1, x: 0, y: 0},
                    {h: 1, i: 'second', w: 3, x: 2, y: 0},
                ]}
                rowHeight={100}
            >
                <div key="first" />
                <div key="second" />
            </Layout>,
        );

        act(() => {
            emitResize(1000);
        });

        const first = container.querySelector<HTMLElement>(
            '.react-grid-item[data-dashkit-grid-x="0"]',
        );
        const second = container.querySelector<HTMLElement>(
            '.react-grid-item[data-dashkit-grid-x="2"]',
        );
        expect(first?.style.transform).toBe('translate(10px,10px)');
        expect(first?.style.width).toBe('73px');
        expect(second?.style.transform).toBe('translate(175px,10px)');
        expect(second?.style.width).toBe('238px');
    });

    test('forwards transform mode through GridItem and uses transforms by default', () => {
        const {container} = render(
            <Layout
                cols={12}
                isDraggable={false}
                isResizable={false}
                layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                rowHeight={100}
            >
                {gridItem}
            </Layout>,
        );
        const item = container.querySelector<HTMLElement>('.react-grid-item');

        act(() => {
            emitResize(900);
        });

        expect(item?.style.width).toBe('213px');
        expect(item?.dataset.dashkitGridUseCssTransforms).toBe('true');
        expect(item?.style.transform).toBe('translate(158px,10px)');
        expect(item?.style.left).toBe('');
        expect(item?.style.top).toBe('');
    });

    test('switches to top and left without stale transform when CSS transforms are disabled', () => {
        const {container, rerender} = render(
            <Layout
                cols={12}
                isDraggable={false}
                isResizable={false}
                layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                rowHeight={100}
            >
                {gridItem}
            </Layout>,
        );
        const item = container.querySelector<HTMLElement>('.react-grid-item');

        act(() => {
            emitResize(900);
        });
        rerender(
            <Layout
                cols={12}
                isDraggable={false}
                isResizable={false}
                layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                rowHeight={100}
                useCSSTransforms={false}
            >
                {gridItem}
            </Layout>,
        );
        act(() => {
            emitResize(1000);
        });

        expect(item?.dataset.dashkitGridUseCssTransforms).toBe('false');
        expect(item?.style.width).toBe('238px');
        expect(item?.style.left).toBe('175px');
        expect(item?.style.top).toBe('10px');
        expect(item?.style.transform).toBe('');
    });

    test('resizes only direct grid items when layouts are nested', () => {
        const {container, getByTestId} = render(
            <Layout
                cols={12}
                isDraggable={false}
                isResizable={false}
                layout={[{h: 1, i: 'outer', w: 3, x: 2, y: 0}]}
                rowHeight={100}
            >
                <div data-testid="outer-item" key="outer">
                    <Layout
                        cols={12}
                        isDraggable={false}
                        isResizable={false}
                        layout={[{h: 1, i: 'inner', w: 2, x: 1, y: 0}]}
                        rowHeight={100}
                    >
                        <div data-testid="inner-item" key="inner" />
                    </Layout>
                </div>
            </Layout>,
        );
        const layouts = container.querySelectorAll('.react-grid-layout');
        const outerItem = getByTestId('outer-item');
        const innerItem = getByTestId('inner-item');

        act(() => {
            emitResizeFor(layouts[1], 500);
        });
        const innerWidth = innerItem.style.width;
        const innerTransform = innerItem.style.transform;
        expect(innerWidth).toBe('72px');
        expect(innerTransform).toBe('translate(51px,10px)');

        act(() => {
            emitResizeFor(layouts[0], 1000);
        });

        expect(outerItem.style.width).toBe('238px');
        expect(innerItem.style.width).toBe(innerWidth);
        expect(innerItem.style.transform).toBe(innerTransform);
    });

    test('updates editable idle geometry and refreshes RGL width before interaction', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const {container} = render(
            <Layout
                cols={12}
                isDraggable={true}
                isResizable={true}
                layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );
        const item = container.querySelector<HTMLElement>(
            '.react-grid-item[data-dashkit-grid-cols]',
        );

        act(() => {
            emitResize(900);
        });

        expect(item?.style.width).toBe('213px');
        expect(item?.style.transform).toBe('translate(158px,10px)');

        item?.classList.add('react-draggable-dragging');
        act(() => {
            emitResize(1000);
        });
        expect(item?.style.width).toBe('213px');
        item?.classList.remove('react-draggable-dragging');

        act(() => {
            fireEvent.pointerDown(item as HTMLElement);
        });

        const lastRenderInstance = renderSpy.mock.instances.at(-1) as unknown as ReactGridLayout;
        expect(lastRenderInstance.props.width).toBe(1000);
        renderSpy.mockRestore();
    });

    test('syncs RGL width before native and shared drag-over after passive resize', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const dragStateRef = {current: {isDragging: true, sourceGroup: 'source'}};
        const widths = [900, 1000];
        const onDropDragOver = jest.fn(() => {
            const instance = renderSpy.mock.instances.at(-1) as unknown as ReactGridLayout;

            expect(instance.props.width).toBe(widths[onDropDragOver.mock.calls.length - 1]);
            return {};
        });
        const {container} = render(
            <Layout
                cols={12}
                dragStateRef={dragStateRef}
                group="target"
                isDroppable={true}
                layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                onDropDragOver={onDropDragOver}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );
        const layout = container.querySelector<HTMLElement>('.react-grid-layout');
        const rendersBeforeResize = renderSpy.mock.calls.length;

        act(() => {
            emitResizeFor(layout as HTMLElement, 900);
        });
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeResize);

        act(() => {
            fireEvent.dragOver(layout as HTMLElement, {clientX: 100, clientY: 100});
        });

        act(() => {
            emitResizeFor(layout as HTMLElement, 1000);
        });
        const rendersBeforeSharedDragOver = renderSpy.mock.calls.length;

        act(() => {
            fireEvent.mouseEnter(layout as HTMLElement);
            fireEvent.mouseMove(layout as HTMLElement, {clientX: 100, clientY: 100});
        });

        expect(renderSpy.mock.calls.length).toBeGreaterThan(rendersBeforeSharedDragOver);
        expect(onDropDragOver).toHaveBeenCalledTimes(2);
        renderSpy.mockRestore();
    });

    test('refreshes the outer-item cache when the layout children change', () => {
        const {container, rerender} = render(
            <Layout
                cols={12}
                isDraggable={true}
                isResizable={true}
                layout={[{h: 1, i: 'first', w: 1, x: 0, y: 0}]}
                rowHeight={100}
            >
                <div key="first" />
            </Layout>,
        );

        act(() => {
            emitResize(900);
        });
        rerender(
            <Layout
                cols={12}
                isDraggable={true}
                isResizable={true}
                layout={[
                    {h: 1, i: 'first', w: 1, x: 0, y: 0},
                    {h: 1, i: 'second', w: 2, x: 1, y: 0},
                ]}
                rowHeight={100}
            >
                <div key="first" />
                <div key="second" />
            </Layout>,
        );

        const second = container.querySelector<HTMLElement>(
            '.react-grid-item[data-dashkit-grid-x="1"]',
        );
        expect(second?.style.width).toBe('138px');
        expect(second?.style.transform).toBe('translate(84px,10px)');
    });

    test('measures after mount, accepts a visible width after zero and disconnects observer', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const {container, unmount} = render(
            <Layout
                cols={12}
                isDraggable={true}
                layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                measureBeforeMount={true}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );

        const initialRender = renderSpy.mock.instances.at(-1) as unknown as ReactGridLayout;
        expect(initialRender.props.width).toBe(0);
        act(() => {
            emitResize(900);
        });
        expect(
            container.querySelector<HTMLElement>('.react-grid-item[data-dashkit-grid-cols]')?.style
                .width,
        ).toBe('64px');

        unmount();
        expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1);
        renderSpy.mockRestore();
    });

    test('keeps WidthProvider placeholder class names', () => {
        render(
            <Layout
                className="custom-layout"
                cols={12}
                layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                measureBeforeMount={true}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );

        expect(resizeObservers[0].unobserve.mock.calls[0][0].className).toBe(
            'custom-layout react-grid-layout',
        );
    });

    test('moves observer and pointer listener from measurement placeholder to grid root', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const {container} = render(
            <Layout
                cols={12}
                isDraggable={true}
                layout={[{h: 1, i: 'item', w: 3, x: 2, y: 0}]}
                measureBeforeMount={true}
                rowHeight={100}
            >
                <div key="item" />
            </Layout>,
        );
        const placeholder = resizeObservers[0].unobserve.mock.calls[0][0] as HTMLElement;
        const layout = container.querySelector<HTMLElement>('.react-grid-layout');
        const item = container.querySelector<HTMLElement>('.react-grid-item');
        const rendersBeforeSync = renderSpy.mock.calls.length;
        const widthBeforeOldTargetDelivery = item?.style.width;

        expect(resizeObservers[0].elements.has(placeholder)).toBe(false);
        expect(resizeObservers[0].elements.has(layout as HTMLElement)).toBe(true);
        act(() => {
            resizeObservers[0].callback([
                {contentRect: {width: 700}, target: placeholder} as unknown as ResizeObserverEntry,
            ]);
        });
        expect(item?.style.width).toBe(widthBeforeOldTargetDelivery);

        act(() => {
            emitResizeFor(layout as HTMLElement, 900);
        });
        expect(item?.style.width).toBe('213px');

        fireEvent.pointerDown(placeholder);
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeSync);
        fireEvent.pointerDown(layout as HTMLElement);
        expect(renderSpy).toHaveBeenCalledTimes(rendersBeforeSync + 1);
        renderSpy.mockRestore();
    });

    test('installs and removes drag-over listeners on grid root', () => {
        const addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'removeEventListener');
        const {container, unmount} = render(
            <Layout cols={12} layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]} rowHeight={100}>
                <div key="item" />
            </Layout>,
        );
        const layout = container.querySelector<HTMLElement>('.react-grid-layout');
        const dragEventNames = ['mouseup', 'mouseenter', 'mouseleave', 'mousemove'];
        const callsOnLayout = (spy: jest.SpyInstance) =>
            spy.mock.calls.filter(
                ([eventName], index) =>
                    spy.mock.contexts[index] === layout && dragEventNames.includes(eventName),
            );

        expect(callsOnLayout(addEventListenerSpy)).toHaveLength(dragEventNames.length);

        unmount();

        expect(callsOnLayout(removeEventListenerSpy)).toHaveLength(dragEventNames.length);
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('re-observes grid root and restores pointerdown after StrictMode remount', () => {
        const renderSpy = jest.spyOn(ReactGridLayout.prototype, 'render');
        const {container} = render(
            <React.StrictMode>
                <Layout
                    cols={12}
                    isDraggable={true}
                    layout={[{h: 1, i: 'item', w: 1, x: 0, y: 0}]}
                    rowHeight={100}
                >
                    <div key="item" />
                </Layout>
            </React.StrictMode>,
        );
        const layout = container.querySelector<HTMLElement>('.react-grid-layout');
        const currentObserver = resizeObservers.at(-1) as TestResizeObserver;

        expect(resizeObservers).toHaveLength(2);
        expect(currentObserver.elements.has(layout as HTMLElement)).toBe(true);
        act(() => {
            currentObserver.callback([
                {contentRect: {width: 900}, target: layout} as unknown as ResizeObserverEntry,
            ]);
        });
        const rendersBeforePointerDown = renderSpy.mock.calls.length;

        fireEvent.pointerDown(layout as HTMLElement);

        expect(renderSpy.mock.calls.length).toBeGreaterThan(rendersBeforePointerDown);
        renderSpy.mockRestore();
    });

    test('keeps unchanged GridItem child clone during another item layout update', () => {
        const renderSpy = jest.spyOn(GridItemComponent.prototype, 'render');
        const first = <GridItem {...gridItem.props} id="first" key="first" />;
        const second = <GridItem {...gridItem.props} id="second" key="second" />;
        const {container, rerender} = render(
            <Layout
                cols={12}
                layout={[
                    {h: 1, i: 'first', w: 1, x: 0, y: 0},
                    {h: 1, i: 'second', w: 1, x: 2, y: 0},
                ]}
                rowHeight={100}
            >
                {first}
                {second}
            </Layout>,
        );
        const secondRenders = renderSpy.mock.instances.filter(
            (instance) => instance.props.id === 'second',
        ).length;

        rerender(
            <Layout
                cols={12}
                layout={[
                    {h: 1, i: 'first', w: 1, x: 1, y: 0},
                    {h: 1, i: 'second', w: 1, x: 2, y: 0},
                ]}
                rowHeight={100}
            >
                {first}
                {second}
            </Layout>,
        );

        expect(
            renderSpy.mock.instances.filter((instance) => instance.props.id === 'second').length,
        ).toBe(secondRenders);
        expect(
            container.querySelector<HTMLElement>('.react-grid-item[data-dashkit-grid-x="1"]'),
        ).not.toBeNull();
        renderSpy.mockRestore();
    });
});
