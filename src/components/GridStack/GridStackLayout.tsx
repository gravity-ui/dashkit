import React from 'react';

import isEqual from 'lodash/isEqual';
import {createPortal} from 'react-dom';
import ResizeObserverPolyfill from 'resize-observer-polyfill';

import {
    DEFAULT_GROUP,
    DRAGGABLE_CANCEL_CLASS_NAME,
    TEMPORARY_ITEM_ID,
} from '../../constants/common';
import {DashKitContext} from '../../context';
import type {DashKitCtxShape} from '../../context';
import type {Config, ConfigItem, ConfigLayout} from '../../shared';
import type {
    ItemManipulationCallback,
    PluginRef,
    ReactGridLayoutProps,
    WidgetLayout,
} from '../../typings';
import GridItem from '../GridItem/GridItem';
import MobileLayout from '../MobileLayout/MobileLayout';

import {
    getContainerDescendants,
    getGridKey,
    projectLayoutDocument,
    validateConfig,
    validateGrid,
} from './document';
import {DashKitEngine} from './engine';
import {
    GridStackWidthError,
    getGridGeometry,
    getGridStackLayoutRects,
    visibleGeometry,
} from './geometry';
import {getGridProperties} from './grid-properties';
import {requireValue} from './invariants';
import {DashKitNativeGrid} from './native-grid';
import {DDManager, GridStack} from './runtime';
import type {DDElementHost, GridItemHTMLElement, GridStackNode, GridStackOptions} from './runtime';

import './GridStack.scss';

interface Host {
    el: GridItemHTMLElement;
    content: HTMLElement;
    key: string;
    container?: boolean;
    lastRecord?: GridRecord;
    dragObserver?: MutationObserver;
}
interface GridRecord {
    grid: DashKitNativeGrid;
    wrapper: HTMLElement;
    root: HTMLElement;
    properties: ReactGridLayoutProps;
    geometry: ReturnType<typeof getGridGeometry>;
    parent?: string;
    containerId?: string;
}
interface Gesture {
    id: string;
    resize: boolean;
    oldItem: WidgetLayout;
    event: Event;
    element: HTMLElement;
    sourceKey: string;
    width: number;
    height: number;
    cancelled?: boolean;
}
const position = (id: string, node: GridStackNode): ConfigLayout => ({
    i: id,
    x: requireValue(node.x, 'node.x'),
    y: requireValue(node.y, 'node.y'),
    w: requireValue(node.w, 'node.w'),
    h: requireValue(node.h, 'node.h'),
});

const hasInvertedConstraints = ({minW, maxW, minH, maxH}: Partial<WidgetLayout>) =>
    (minW !== undefined && maxW !== undefined && minW > maxW) ||
    (minH !== undefined && maxH !== undefined && minH > maxH);

const gridDepth = ({grid}: GridRecord) => {
    let depth = 0;
    for (let parent = grid.parentGridNode; parent; parent = parent.grid?.parentGridNode) {
        depth++;
    }
    return depth;
};

class GridStackCanvas extends React.PureComponent {
    static contextType = DashKitContext;
    declare context: DashKitCtxShape;
    private roots = new Map<string, HTMLElement>();
    private grids = new Map<string, GridRecord>();
    private hosts = new Map<string, Host>();
    private plugins = new Map<string, PluginRef>();
    private autoHeightItems = new Set<string>();
    private pluginCallbacks = new Map<string, (value: PluginRef) => void>();
    private autoheightWidgets = new Set<string>();
    private observer?: ResizeObserver;
    private syncing = false;
    private appliedContext?: DashKitCtxShape;
    private active?: Gesture;
    private preview?: ConfigItem;
    private finishQueued = false;
    private timer?: ReturnType<typeof setTimeout>;
    private lastReload = 0;
    private mounted = false;
    private frame?: number;

    componentDidMount() {
        this.mounted = true;
        const Observer =
            typeof ResizeObserver === 'function' ? ResizeObserver : ResizeObserverPolyfill;
        this.observer = new Observer(() => {
            if (!this.active && !this.preview) {
                this.sync();
            }
        });
        this.sync();
        this.reloadItems();
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('dragend', this.clearPreview);
        window.addEventListener('mouseup', this.preparePointerStop, true);
        window.addEventListener('mouseup', this.finishPointer);
        window.addEventListener('touchend', this.preparePointerStop, true);
        window.addEventListener('touchend', this.finishPointer);
        window.addEventListener('mousemove', this.refreshGestureScale, true);
        window.addEventListener('touchmove', this.refreshGestureScale, {
            capture: true,
            passive: true,
        });
    }
    componentDidUpdate() {
        if (
            this.active &&
            this.appliedContext?.externalLayoutRevision !== this.context.externalLayoutRevision
        ) {
            this.active.cancelled = true;
            // Finish native pointer cleanup before applying the authoritative document.
            this.syncing = true;
            try {
                const el = this.active.element as GridItemHTMLElement;
                el.gridstackNode?.grid?.prepareDragDrop(el, true);
            } finally {
                this.syncing = false;
            }
            const host = this.hosts.get(this.active.id);
            if (host?.el.gridstackNode) {
                this.membership(host);
            }
            this.sync();
        }
        if (!this.active && this.appliedContext !== this.context) {
            const previous = this.appliedContext;
            if (
                this.preview &&
                previous?.config === this.context.config &&
                previous.externalLayoutRevision === this.context.externalLayoutRevision &&
                previous.layout === this.context.layout &&
                previous.containers === this.context.containers &&
                previous.temporaryLayout === this.context.temporaryLayout &&
                previous.dragProps === this.context.dragProps &&
                previous.dragOverPlugin === this.context.dragOverPlugin &&
                previous.editMode === this.context.editMode &&
                previous.groups === this.context.groups &&
                previous.draggableHandleClassName === this.context.draggableHandleClassName &&
                [...this.grids].every(([key, record]) => {
                    const properties = this.getProperties(key);
                    return (
                        (record.containerId ||
                            (this.roots.get(key) === record.wrapper &&
                                record.wrapper.firstElementChild === record.root)) &&
                        isEqual(record.properties, properties) &&
                        isEqual(
                            record.geometry,
                            getGridGeometry(
                                properties.width ?? record.wrapper.clientWidth,
                                properties,
                            ),
                        )
                    );
                })
            ) {
                // Callback/metadata updates must not restore saved positions over a live preview.
                this.appliedContext = this.context;
            } else {
                this.clearPreview();
                this.sync();
            }
        }
        clearTimeout(this.timer);
        this.reloadItems();
    }
    componentWillUnmount() {
        this.mounted = false;
        this.clearPreview();
        clearTimeout(this.timer);
        if (this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
        }
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        window.removeEventListener('dragend', this.clearPreview);
        window.removeEventListener('mouseup', this.preparePointerStop, true);
        window.removeEventListener('mouseup', this.finishPointer);
        window.removeEventListener('touchend', this.preparePointerStop, true);
        window.removeEventListener('touchend', this.finishPointer);
        window.removeEventListener('mousemove', this.refreshGestureScale, true);
        window.removeEventListener('touchmove', this.refreshGestureScale, true);
        this.observer?.disconnect();
        for (const host of this.hosts.values()) {
            host.dragObserver?.disconnect();
            delete host.dragObserver;
        }
        [...this.grids.values()]
            .sort((a, b) => gridDepth(b) - gridDepth(a))
            .forEach(({grid, root}) => {
                root.removeEventListener('dragover', this.paletteOver);
                root.removeEventListener('drop', this.paletteDrop);
                root.removeEventListener('dragleave', this.paletteLeave);
                grid.destroy(false);
            });
        this.grids.clear();
        this.plugins.clear();
    }
    render() {
        const {
            groups = [{id: DEFAULT_GROUP}],
            config,
            configItems,
            editMode,
            context,
        } = this.context;
        const propertiesByGrid = new Map(
            [...this.grids.keys()]
                .filter(
                    (key) =>
                        !key.startsWith('container:') ||
                        this.context.containers?.some(({id}) => key === `container:${id}`),
                )
                .map((key) => [key, this.getProperties(key)]),
        );
        const portals = configItems.map((item) => this.renderItem(item, propertiesByGrid));
        const customHandles = [...this.hosts].flatMap(([id, host]) => {
            const properties = propertiesByGrid.get(host.key);
            if (!properties?.resizeHandle) {
                return [];
            }
            return (properties.resizeHandles || ['se']).map((direction) => {
                const target = host.el.querySelector(`.ui-resizable-${direction}`);
                const handle =
                    typeof properties.resizeHandle === 'function'
                        ? properties.resizeHandle(direction)
                        : properties.resizeHandle;
                return target ? createPortal(handle, target, `${id}:${direction}`) : null;
            });
        });
        const temporary = this.context.temporaryLayout;
        const preview =
            this.preview ||
            (temporary
                ? {
                      id: TEMPORARY_ITEM_ID,
                      type: temporary.dragProps.type,
                      namespace: 'default',
                      data: {},
                  }
                : undefined);
        return (
            <div
                className={`dashkit dashkit-gridstack dashkit_theme_${this.context.registerManager.settings.theme}`}
                style={
                    groups.some(
                        (group) =>
                            this.getProperties(`zone:${group.id || DEFAULT_GROUP}`).autoSize ===
                            false,
                    )
                        ? {height: '100%'}
                        : undefined
                }
                data-dashkit-engine="gridstack"
                data-dashkit-engine-version="12.6.0"
            >
                {groups.map((group) => {
                    const id = group.id || DEFAULT_GROUP;
                    const key = `zone:${id}`;
                    const properties = this.getProperties(key);
                    const children = (
                        <div
                            key={key}
                            className="dashkit-gridstack__zone"
                            style={properties.style}
                            ref={(el) => {
                                if (el) {
                                    this.roots.set(key, el);
                                } else {
                                    this.roots.delete(key);
                                }
                            }}
                        >
                            <div
                                className={`grid-stack react-grid-layout ${properties.className || ''}`}
                            />
                        </div>
                    );
                    return group.render
                        ? group.render(id, children, {
                              config,
                              editMode,
                              isMobile: false,
                              items: configItems.filter((item) =>
                                  this.context.layout.some(
                                      (entry) =>
                                          entry.i === item.id &&
                                          (entry.parent || DEFAULT_GROUP) === id,
                                  ),
                              ),
                              layout: this.context.layout.filter(
                                  (entry) => (entry.parent || DEFAULT_GROUP) === id,
                              ),
                              context,
                          })
                        : children;
                })}
                {portals}
                {customHandles}
                {preview ? this.renderItem(preview, propertiesByGrid, true) : null}
            </div>
        );
    }
    getItemsMeta = () =>
        this.context.getItemsMeta(
            this.context.configItems
                .map(({id}) => this.plugins.get(id))
                .filter((ref): ref is PluginRef => ref !== undefined),
        );
    reloadItems = ({targetIds, force}: {targetIds?: string[]; force?: boolean} = {}) => {
        const {settings, editMode} = this.context;
        const interval = Number(settings.autoupdateInterval) * 1000;
        const remaining = interval - (Date.now() - this.lastReload);
        // Initial sync creates portal targets before React commits plugin refs.
        if (
            this.plugins.size &&
            (force || (interval && !document.hidden && !editMode && remaining <= 0))
        ) {
            if (interval) {
                this.lastReload = Date.now();
            }
            this.context.reloadItems(
                this.context.configItems
                    .filter(({id}) => !targetIds || targetIds.includes(id))
                    .map(({id}) => this.plugins.get(id))
                    .filter((ref): ref is PluginRef => ref !== undefined),
                {silentLoading: Boolean(settings.silentLoading), noVeil: true},
            );
        }
        clearTimeout(this.timer);
        if (interval) {
            this.timer = setTimeout(
                () => this.reloadItems(),
                Math.max(1, remaining <= 0 ? interval : remaining),
            );
        }
    };
    // Refresh before native document handlers calculate helper/UI geometry for this motion.
    private preparePointerStop = () => {
        const active = this.active;
        if (!active || active.resize) {
            return;
        }
        const el = active.element as GridItemHTMLElement;
        const grid = el.gridstackNode?.grid;
        if (grid instanceof DashKitNativeGrid && grid.hasPreview()) {
            // Retain the last bounded native destination after its pointer surface is left.
            DDManager.dropElement = requireValue(
                (grid.el as DDElementHost).ddElement?.ddDroppable,
                'native drop target',
            );
        } else if (DDManager.dropElement) {
            // GridStack removes a React portal host when dropping without an admitted placeholder.
            Reflect.deleteProperty(DDManager, 'dropElement');
            active.cancelled = true;
        }
    };
    private finishPointer = (event: Event) => {
        if (this.active && !this.active.resize) {
            this.finish(event, this.active.element as GridItemHTMLElement);
        }
    };
    private refreshGestureScale = (event: Event) => {
        const el = this.active?.element as GridItemHTMLElement | undefined;
        const grid = el?.gridstackNode?.grid;
        if (el && grid instanceof DashKitNativeGrid) {
            grid.refreshMotionScale(el, event, Boolean(this.active?.resize));
        }
    };
    private onVisibilityChange = () => this.reloadItems();
    private getProperties(key: string) {
        return getGridProperties(
            key,
            this.context.registerManager.gridLayout,
            this.context.groups,
            this.context.containers,
        );
    }
    private createGrid(key: string, wrapper: HTMLElement, root: HTMLElement) {
        const properties = this.getProperties(key);
        validateGrid(properties);
        const options: GridStackOptions = {
            column: properties.cols || 36,
            cellHeight: (properties.rowHeight ?? 18) + (properties.margin?.[1] ?? 2),
            margin: 0,
            float: true,
            animate: false,
            auto: false,
            engineClass: DashKitEngine,
            alwaysShowResizeHandle: true,
            maxRow: Number.isFinite(properties.maxRows) ? properties.maxRows : undefined,
            acceptWidgets: (el) => this.accept(key, el as GridItemHTMLElement),
            subGridDynamic: false,
            draggable: {
                handle: this.context.draggableHandleClassName
                    ? `.${this.context.draggableHandleClassName}`
                    : '.grid-stack-item-content',
                cancel: `.${DRAGGABLE_CANCEL_CLASS_NAME}`,
                scroll: !properties.isBounded,
            },
            resizable: {handles: (properties.resizeHandles || ['se']).join(',')},
        };
        const grid = new DashKitNativeGrid(root, options);
        grid.onCancel = () => {
            if (this.active) {
                this.active.cancelled = true;
            }
        };
        const record: GridRecord = {
            grid,
            wrapper,
            root,
            properties,
            geometry: getGridGeometry(0, properties),
        };
        // Teardown still needs the applied settings after controlled descriptors disappear.
        grid.properties = () => (this.syncing ? record.properties : this.getProperties(key));
        if (key.startsWith('container:')) {
            record.containerId = key.slice(10);
            record.parent = this.context.containers?.find(
                ({id}) => id === record.containerId,
            )?.parent;
        } else {
            record.parent = key.slice(5) === DEFAULT_GROUP ? undefined : key.slice(5);
        }
        this.grids.set(key, record);
        grid.on('dragstart resizestart', (event: Event, el: GridItemHTMLElement) =>
            this.start(event, el),
        );
        grid.on('drag resize', (event: Event, el: GridItemHTMLElement) => this.move(event, el));
        grid.on('dragstop resizestop', (event: Event, el: GridItemHTMLElement) =>
            this.finish(event, el),
        );
        grid.on('dropped', (event, _previous, node) =>
            this.finish(event, requireValue(node.el, 'native node element')),
        );
        this.observer?.observe(wrapper);
        root.addEventListener('dragover', this.paletteOver);
        root.addEventListener('drop', this.paletteDrop);
        root.addEventListener('dragleave', this.paletteLeave);
        return record;
    }
    private syncDragHandle(id: string) {
        const host = this.hosts.get(id);
        if (!host || !this.mounted || this.active || this.preview || this.context.temporaryLayout) {
            return;
        }
        const custom = host.container ? undefined : this.context.draggableHandleClassName;
        if (!custom && !host.dragObserver && !host.container) {
            return;
        }
        const grid = this.grids.get(host.key)?.grid;
        if (!grid || host.el.gridstackNode?.grid !== grid) {
            return;
        }
        if (custom && !host.dragObserver) {
            // Portal content and async plugin handles can appear after makeWidget initializes DD.
            host.dragObserver = new MutationObserver(() => this.syncDragHandle(id));
            host.dragObserver.observe(host.content, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }
        const selector = custom ? `.${custom}, .${custom} *` : '.grid-stack-item-content';
        const elements = [...host.el.querySelectorAll(selector)].filter(
            (element) =>
                element.closest('.grid-stack-item') === host.el &&
                !element.closest('input, textarea, select, option'),
        );
        grid.setDragHandles(host.el, selector, elements);
        if (custom && !elements.length) {
            GridStack.getDD().draggable(host.el, 'disable');
        }
        if (!custom) {
            host.dragObserver?.disconnect();
            delete host.dragObserver;
        }
    }
    private createHost(id: string, key: string, container = false): Host {
        const el: GridItemHTMLElement = document.createElement('div');
        el.className = 'grid-stack-item react-grid-item dashkit-gridstack__host';
        el.dataset.dashkitId = id;
        const content = document.createElement('div');
        content.className = 'grid-stack-item-content';
        if (container) {
            // Descendant handles and widget bodies must never start an ancestor drag.
            const ownSurface = (event: Event) => {
                if ((event.target as Element).closest('.grid-stack-item') !== el) {
                    event.stopImmediatePropagation();
                }
            };
            for (const type of ['mousedown', 'touchstart', 'pointerdown']) {
                content.addEventListener(type, ownSurface);
            }
        }
        el.appendChild(content);
        const host = {el, content, key, container};
        this.hosts.set(id, host);
        return host;
    }
    private attach(id: string, entry: Omit<ConfigLayout, 'i'>, container = false) {
        const key = getGridKey(entry);
        const record = this.grids.get(key);
        const previous = this.hosts.get(id);
        if (!record) {
            if (previous) {
                this.grids.get(previous.key)?.grid.removeWidget(previous.el, false, false);
                previous.el.remove();
                previous.key = key;
            }
            return undefined;
        }
        const host = previous || this.createHost(id, key, container);
        host.lastRecord = record;
        if (host.key !== key) {
            this.grids.get(host.key)?.grid.removeWidget(host.el, false, false);
            host.key = key;
        }
        const constraints = entry as Partial<WidgetLayout>;
        const inheritedConstraints =
            entry.containerId && !container
                ? this.convertConstraints(
                      constraints,
                      this.grids.get(`zone:${entry.parent || DEFAULT_GROUP}`) || record,
                      record,
                  )
                : constraints;
        const node = {
            id,
            x: entry.x,
            y: entry.y,
            w: entry.w,
            h: entry.h,
            minW: inheritedConstraints.minW,
            // Autoheight constraints are already expressed in the containing grid units.
            minH: this.autoHeightItems.has(id) ? constraints.minH : inheritedConstraints.minH,
            maxW: inheritedConstraints.maxW,
            maxH: this.autoHeightItems.has(id) ? constraints.maxH : inheritedConstraints.maxH,
        };
        if (host.el.parentElement !== record.root || host.el.gridstackNode?.grid !== record.grid) {
            const owner = host.el.gridstackNode?.grid;
            if (owner && owner !== record.grid) {
                host.el.remove();
                owner.removeWidget(host.el, false, false);
            }
            record.root.appendChild(host.el);
            record.grid.makeWidget(host.el, node);
        }
        const current = host.el.gridstackNode;
        if (
            Object.entries(node).some(
                ([field, value]) => current?.[field as keyof typeof node] !== value,
            )
        ) {
            record.grid.update(host.el, node);
        }
        return host;
    }
    private validateGeometry(config: Config, measured = false) {
        const rootGrids = Object.fromEntries(
            [...this.roots]
                .map(([key, wrapper]) => {
                    const gridProperties = this.getProperties(key);
                    const previous = this.grids.get(key)?.geometry;
                    return [
                        key.slice(5),
                        {
                            width:
                                gridProperties.width ??
                                (wrapper.clientWidth ||
                                    (previous
                                        ? previous.stepX * previous.cols +
                                          2 * previous.paddingX -
                                          previous.gapX
                                        : 0)),
                            gridProperties,
                        },
                    ] as const;
                })
                .filter(([, {width}]) => width > 0),
        );
        for (const [id, root] of Object.entries(rootGrids)) {
            if (!config.containers?.some((entry) => (entry.parent || DEFAULT_GROUP) === id)) {
                continue;
            }
            try {
                getGridStackLayoutRects(
                    {
                        ...config,
                        layout: config.layout.filter(
                            (entry) => (entry.parent || DEFAULT_GROUP) === id,
                        ),
                        containers: config.containers.filter(
                            (entry) => (entry.parent || DEFAULT_GROUP) === id,
                        ),
                    },
                    {[id]: root},
                );
            } catch (error) {
                if (
                    measured &&
                    root.gridProperties.width === undefined &&
                    error instanceof GridStackWidthError
                ) {
                    return false;
                }
                throw error;
            }
        }
        return true;
    }
    private sync = () => {
        if (this.syncing || !this.mounted) {
            return;
        }
        // Validate new saved input before clipping its temporary visual layout.
        if (this.autoHeightItems.size && this.context.config !== this.appliedContext?.config) {
            if (!this.validateGeometry(this.context.config, true)) {
                return;
            }
        }
        for (const widgetId of this.autoHeightItems) {
            const entry: WidgetLayout | undefined = this.context.layout.find(
                ({i}) => i === widgetId,
            );
            if (entry?.containerId) {
                const remaining =
                    requireValue(
                        this.getProperties(getGridKey(entry)).maxRows,
                        'containing grid row capacity',
                    ) - entry.y;
                if (Math.max(entry.h, entry.minH ?? 0, entry.maxH ?? 0) > remaining) {
                    this.adjustWidgetLayout({widgetId, adjustedWidgetLayout: entry});
                    return;
                }
            }
        }
        if (
            !this.validateGeometry(
                {
                    ...this.context.config,
                    layout: this.context.layout,
                    containers: this.context.containers,
                },
                true,
            )
        ) {
            return;
        }
        this.syncing = true;
        const {configItems, layout, containers = [], temporaryLayout} = this.context;
        const before = this.renderKey();
        try {
            const replaced = [...this.grids]
                .filter(
                    ([key, record]) =>
                        !record.containerId &&
                        (this.roots.get(key) !== record.wrapper ||
                            record.wrapper.firstElementChild !== record.root),
                )
                .map(([, record]) => record.root);
            [...this.grids]
                .sort(([, a], [, b]) => gridDepth(b) - gridDepth(a))
                .forEach(([key, record]) => {
                    if (
                        replaced.some(
                            (root) => root === record.root || root.contains(record.wrapper),
                        )
                    ) {
                        record.root.removeEventListener('dragover', this.paletteOver);
                        record.root.removeEventListener('drop', this.paletteDrop);
                        record.root.removeEventListener('dragleave', this.paletteLeave);
                        this.observer?.unobserve(record.wrapper);
                        record.grid.destroy(false);
                        if (record.containerId) {
                            record.wrapper.remove();
                        }
                        this.grids.delete(key);
                    }
                });
            this.roots.forEach((wrapper, key) => {
                if (!this.grids.has(key)) {
                    this.createGrid(key, wrapper, wrapper.firstElementChild as HTMLElement);
                }
                this.updateGrid(requireValue(this.grids.get(key), 'grid record'), key);
            });
            this.grids.forEach(({grid: gridInput}) => {
                const grid = gridInput;
                (grid.engine as DashKitEngine).restoring = true;
            });
            const pending = [...containers];
            const placedContainers = new Set<string>();
            for (let pass = 0; pending.length && pass <= containers.length; pass++) {
                for (let index = pending.length - 1; index >= 0; index--) {
                    const container = pending[index];
                    if (container.containerId && !placedContainers.has(container.containerId)) {
                        continue;
                    }
                    const host = this.attach(container.id, container, true);
                    if (!host) {
                        continue;
                    }
                    host.content.classList.add('dashkit-gridstack__container');
                    const key = `container:${container.id}`;
                    if (!this.grids.has(key)) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'dashkit-gridstack__zone';
                        const root = document.createElement('div');
                        root.className = 'grid-stack react-grid-layout';
                        wrapper.appendChild(root);
                        host.content.appendChild(wrapper);
                        const child = this.createGrid(key, wrapper, root);
                        this.updateGrid(child, key);
                        (child.grid.engine as DashKitEngine).restoring = true;
                    }
                    const child = requireValue(this.grids.get(key), 'grid record');
                    child.grid.parentGridNode = host.el.gridstackNode;
                    requireValue(host.el.gridstackNode, 'host native node').subGrid = child.grid;
                    host.content.style.padding = container.padding
                        .map((value) => `${value}px`)
                        .join(' ');
                    placedContainers.add(container.id);
                    pending.splice(index, 1);
                }
            }
            const activeLayout = temporaryLayout?.data || layout;
            configItems.forEach((item) => {
                const entry = activeLayout.find(({i}) => i === item.id);
                if (entry) {
                    this.attach(item.id, entry);
                }
            });
            const temporary = temporaryLayout?.data.find(({i}) => i === TEMPORARY_ITEM_ID);
            if (temporary) {
                this.attach(TEMPORARY_ITEM_ID, temporary);
            }
            // Reordering saved items changes overlap stacking without replacing portal targets.
            this.grids.forEach((record, key) => {
                let next: HTMLElement | null = null;
                [...configItems].reverse().forEach(({id}) => {
                    const host = this.hosts.get(id);
                    if (host?.key === key) {
                        if (host.el.nextElementSibling !== next) {
                            record.root.insertBefore(host.el, next);
                        }
                        next = host.el;
                    }
                });
            });
            const retained = new Set([
                ...configItems.map(({id}) => id),
                ...containers.map(({id}) => id),
            ]);
            if (temporaryLayout || this.preview) {
                retained.add(TEMPORARY_ITEM_ID);
            }
            this.hosts.forEach((host, id) => {
                if (!retained.has(id)) {
                    host.dragObserver?.disconnect();
                    this.grids.get(host.key)?.grid.removeWidget(host.el, false, false);
                    host.el.remove();
                    this.hosts.delete(id);
                    this.autoHeightItems.delete(id);
                    this.plugins.delete(id);
                    this.pluginCallbacks.delete(id);
                }
            });
            // Saved geometry restores verbatim; only autoheight reflows its visual neighbors.
            const autoheightWidgets = new Set(this.context.adjustedLayoutIds);
            this.grids.forEach(({grid}) => {
                const engine = grid.engine as DashKitEngine;
                engine.restoring = false;
                const adjusted = engine.nodes.filter((node) => {
                    const id = requireValue(node.id, 'autoheight widget id');
                    // Previous IDs keep the reset's final reflow before adjustment ends.
                    return autoheightWidgets.has(id) || this.autoheightWidgets.has(id);
                });
                if (adjusted.length) {
                    adjusted
                        .sort((a, b) => a.y - b.y || a.x - b.x)
                        .forEach((node) => engine._fixCollisions(node));
                    engine._packNodes();
                }
            });
            this.autoheightWidgets = autoheightWidgets;
            [...this.grids]
                .sort(([, a], [, b]) => gridDepth(b) - gridDepth(a))
                .forEach(([key, record]) => {
                    if (
                        record.containerId &&
                        !containers.some(({id}) => id === record.containerId)
                    ) {
                        record.grid.destroy(false);
                        this.observer?.unobserve(record.wrapper);
                        this.grids.delete(key);
                        return;
                    }
                    this.updateGrid(record, key);
                });
            this.hosts.forEach((_host, id) => this.syncDragHandle(id));
        } finally {
            this.grids.forEach(({grid: gridInput}) => {
                const grid = gridInput;
                (grid.engine as DashKitEngine).restoring = false;
            });
            this.syncing = false;
            this.appliedContext = this.context;
        }
        if (before !== this.renderKey()) {
            this.forceUpdate();
        }
    };
    private updateGrid(recordInput: GridRecord, key: string) {
        const record = recordInput;
        const properties = this.getProperties(key);
        validateGrid(properties);
        record.properties = properties;
        if (record.containerId) {
            record.parent = this.context.containers?.find(
                ({id}) => id === record.containerId,
            )?.parent;
        }
        if (properties.autoSize === false && !properties.style?.height) {
            record.wrapper.style.height = '100%';
        }
        const width = properties.width ?? record.wrapper.clientWidth;
        // Hidden measurement is not a new geometry baseline for already mounted content.
        if (properties.width === undefined && width === 0 && record.root.style.width) {
            return;
        }
        record.geometry = getGridGeometry(width, properties);
        const {paddingX, paddingY, gapX, gapY, stepY} = record.geometry;
        record.root.style.left = `${paddingX}px`;
        record.root.style.top = `${paddingY}px`;
        record.root.style.width = `${Math.max(0, width - 2 * paddingX + gapX)}px`;
        const engine = record.grid.engine as DashKitEngine;
        const compactType =
            properties.compactType === undefined ? 'vertical' : properties.compactType;
        engine.mode = {
            compactType: properties.verticalCompact === false ? null : compactType,
            allowOverlap: properties.allowOverlap,
            preventCollision: properties.preventCollision,
        };
        engine.column = properties.cols || 36;
        engine.maxRow = Number.isFinite(properties.maxRows)
            ? requireValue(properties.maxRows, 'properties.maxRows')
            : 0;
        record.grid.opts.column = engine.column;
        record.grid.opts.maxRow = engine.maxRow;
        record.root.style.setProperty('--gs-column-width', `${100 / engine.column}%`);
        record.grid.cellHeight(stepY);
        record.grid.margin(`0 ${gapX}px ${gapY}px 0`);
        const handles = (properties.resizeHandles || ['se']).join(',');
        record.grid.opts.resizable = {...record.grid.opts.resizable, handles};
        const canMove =
            !this.context.temporaryLayout && (properties.isDraggable ?? this.context.editMode);
        const canResize =
            !this.context.temporaryLayout &&
            (properties.isResizable ?? this.context.editMode) &&
            properties.resizeHandles?.length !== 0;
        if (Boolean(record.grid.opts.disableDrag) !== !canMove) {
            record.grid.enableMove(canMove, false);
        }
        if (Boolean(record.grid.opts.disableResize) !== !canResize) {
            record.grid.enableResize(canResize, false);
        }
        record.grid.engine.nodes.forEach((node) => {
            // The runtime accepts handles via option; its published DDKey union omits it.
            if (GridStack.getDD().isResizable(requireValue(node.el, 'native node element'))) {
                GridStack.getDD().resizable(
                    requireValue(node.el, 'native node element'),
                    'option',
                    'handles' as Parameters<ReturnType<typeof GridStack.getDD>['resizable']>[2],
                    handles,
                );
            }
            node.el
                ?.querySelectorAll<HTMLElement>('.ui-resizable-handle')
                .forEach((handleInput) => {
                    const handle = handleInput;
                    const direction = [...handle.classList]
                        .find((name) => /^ui-resizable-(n|s|e|w|nw|ne|sw|se)$/.test(name))
                        ?.slice(13);
                    if (direction) {
                        handle.dataset.qa = `dashkit-resize-${direction}`;
                        handle.classList.add(
                            'react-resizable-handle',
                            `react-resizable-handle-${direction}`,
                        );
                    }
                });
            const min = this.minimumContainer(node.id, record);
            if (min) {
                record.grid.update(requireValue(node.el, 'native node element'), min);
            }
        });
        record.grid.refreshPositions();
    }
    private minimumContainer(id: string | undefined, parent: GridRecord) {
        const container = this.context.containers?.find((entry) => entry.id === id);
        const child = this.grids.get(`container:${id}`);
        if (!container || !child) {
            return undefined;
        }
        const entries = [
            ...this.context.layout.filter((entry) => entry.containerId === id),
            ...(this.context.containers || []).filter((entry) => entry.containerId === id),
        ];
        const right = entries.reduce((max, entry) => Math.max(max, entry.x + entry.w), 0);
        const bottom = entries.reduce((max, entry) => Math.max(max, entry.y + entry.h), 0);
        const [top, paddingRight, paddingBottom, left] = container.padding;
        const minWidth = right * child.geometry.stepX - child.geometry.gapX + left + paddingRight;
        const minHeight = bottom * child.geometry.stepY - child.geometry.gapY + top + paddingBottom;
        return {
            minW: Math.max(1, Math.ceil((minWidth + parent.geometry.gapX) / parent.geometry.stepX)),
            minH: Math.max(
                1,
                Math.ceil((minHeight + parent.geometry.gapY) / parent.geometry.stepY),
            ),
        };
    }
    private renderKey() {
        return JSON.stringify(
            [...this.hosts].map(([id, host]) => {
                const record = this.grids.get(host.key);
                const node = host.el.gridstackNode;
                const handles = record?.grid.opts.resizable?.handles;
                return [
                    id,
                    host.key,
                    node?.x,
                    node?.y,
                    node?.w,
                    node?.h,
                    record?.geometry,
                    handles,
                ];
            }),
        );
    }
    private convertConstraints(
        entry: Partial<WidgetLayout>,
        source: GridRecord,
        target: GridRecord,
        forAdmission = false,
    ) {
        const result: Partial<WidgetLayout> = {};
        for (const key of ['minW', 'maxW', 'minH', 'maxH'] as const) {
            const value = entry[key];
            if (value === undefined) {
                continue;
            }
            const horizontal = key.endsWith('W');
            const pixels =
                value * (horizontal ? source.geometry.stepX : source.geometry.stepY) -
                (horizontal ? source.geometry.gapX : source.geometry.gapY);
            const units =
                (pixels + (horizontal ? target.geometry.gapX : target.geometry.gapY)) /
                (horizontal ? target.geometry.stepX : target.geometry.stepY);
            const rounded = key.startsWith('min') ? Math.ceil(units) : Math.floor(units);
            // Admission needs raw maxima; native GridStack treats zero maxima as unbounded.
            result[key] = forAdmission && key.startsWith('max') ? rounded : Math.max(1, rounded);
        }
        return result;
    }

    private convertedDropSize(
        id: string,
        node: GridStackNode,
        source: GridRecord | undefined,
        target: GridRecord,
        container: boolean,
    ): (Partial<WidgetLayout> & {w: number; h: number}) | undefined {
        if (!source || source === target) {
            return {w: requireValue(node.w, 'node.w'), h: requireValue(node.h, 'node.h')};
        }
        const visible = this.active || visibleGeometry(position(id, node), source.geometry);
        const constraints = this.convertConstraints(
            this.active?.oldItem || node,
            source,
            target,
            true,
        );
        if (
            (constraints.maxW !== undefined && (constraints.minW ?? 1) > constraints.maxW) ||
            (constraints.maxH !== undefined && (constraints.minH ?? 1) > constraints.maxH)
        ) {
            return undefined;
        }
        return {
            w: Math.max(
                constraints.minW ?? 1,
                Math.min(
                    container ? Infinity : target.geometry.cols,
                    constraints.maxW ?? Infinity,
                    Math.round((visible.width + target.geometry.gapX) / target.geometry.stepX),
                ),
            ),
            h: Math.max(
                constraints.minH ?? 1,
                Math.min(
                    constraints.maxH ?? Infinity,
                    Math.round((visible.height + target.geometry.gapY) / target.geometry.stepY),
                ),
            ),
            ...constraints,
        };
    }

    private accept(key: string, el: GridItemHTMLElement) {
        if (!this.context.editMode) {
            return false;
        }
        const id = el.dataset.dashkitId;
        const host = this.hosts.get(id as string);
        const {containers = []} = this.context;
        const container = containers.find((entry) => entry.id === id);
        if (
            container &&
            [...getContainerDescendants(container.id, containers)].some(
                (descendant) => `container:${descendant}` === key,
            )
        ) {
            return false;
        }
        const record = this.grids.get(key);
        const item = this.context.configItems.find((entry) => entry.id === id);
        const node = el.gridstackNode;
        if (!record || !node || (!item && !container) || host?.el !== el) {
            return false;
        }
        const source = this.grids.get(this.active?.sourceKey || host.key);
        const engine = record.grid.engine as DashKitEngine;
        engine.dropSize = undefined;
        const converted = this.convertedDropSize(
            requireValue(id, 'widget id'),
            node,
            source,
            record,
            Boolean(container),
        );
        if (!converted) {
            return false;
        }
        if (container) {
            const {minW = 1, minH = 1} = this.minimumContainer(container.id, record) || {};
            converted.w = Math.max(converted.w, minW);
            converted.h = Math.max(converted.h, minH);
        }
        if (!engine.willItFit({id, ...converted})) {
            return false;
        }
        const {layout, containers: liveContainers} = this.readDocument();
        const descendants = container
            ? getContainerDescendants(container.id, containers)
            : undefined;
        const candidates = container
            ? this.context.configItems.filter((candidate) =>
                  layout.some(
                      (entry) =>
                          entry.i === candidate.id &&
                          entry.containerId &&
                          descendants?.has(entry.containerId),
                  ),
              )
            : [requireValue(item, 'widget config')];
        const destinationContainers = liveContainers?.map((entry) =>
            descendants?.has(entry.id)
                ? {
                      ...entry,
                      parent: record.parent,
                      ...(entry.id === id ? {...converted, containerId: record.containerId} : {}),
                  }
                : entry,
        );
        const accepted = candidates.every((candidate) => {
            const entry = requireValue(
                layout.find(({i}) => i === candidate.id),
                'admission widget layout',
            );
            const containerId = container ? entry.containerId : record.containerId;
            const properties = container
                ? getGridProperties(
                      getGridKey({...entry, parent: record.parent}),
                      this.context.registerManager.gridLayout,
                      this.context.groups,
                      destinationContainers,
                  )
                : record.properties;
            return (
                this.context.onDropDragOver(
                    {} as Parameters<DashKitCtxShape['onDropDragOver']>[0],
                    record.parent,
                    properties,
                    [
                        ...layout,
                        ...(liveContainers || []).map(({id: containerId, ...entry}) => ({
                            i: containerId,
                            ...entry,
                        })),
                    ].filter(
                        (entry) =>
                            getGridKey(entry) === (container ? `container:${containerId}` : key) &&
                            entry.i !== TEMPORARY_ITEM_ID &&
                            (!container || entry.i !== candidate.id),
                    ),
                    {type: candidate.type, ...entry, ...(container ? {} : converted)},
                    undefined,
                    containerId,
                ) !== false
            );
        });
        engine.dropSize = accepted ? {id: requireValue(id, 'widget id'), ...converted} : undefined;
        return accepted;
    }
    private start(event: Event, el: GridItemHTMLElement) {
        if (this.context.temporaryLayout) {
            return;
        }
        this.clearPreview();
        for (const {grid} of this.grids.values()) {
            (grid.engine as DashKitEngine).dropSize = undefined;
        }
        const id = requireValue(el.dataset.dashkitId, 'gesture widget id');
        const node = requireValue(el.gridstackNode, 'gesture native node');
        const host = requireValue(this.hosts.get(id), 'widget host');
        const record = requireValue(this.grids.get(host.key), 'host grid record');
        const visible = visibleGeometry(position(id, node), record.geometry);
        this.active = {
            id,
            resize: event.type === 'resizestart',
            oldItem: {
                ...this.context.layout.find((entry) => entry.i === id),
                ...position(id, node),
                minW: node.minW,
                minH: node.minH,
                maxW: node.maxW,
                maxH: node.maxH,
            },
            event,
            element: el,
            sourceKey: host.key,
            width: visible.width,
            height: visible.height,
        };
        if (this.context.focusable && !host.container) {
            host.content
                .querySelector<HTMLElement>('.dashkit-grid-item')
                ?.focus({preventScroll: true});
        }
        this.callback(
            this.active.resize ? this.context.onResizeStart : this.context.onDragStart,
            event,
            el,
        );
        this.forceUpdate();
    }
    private move(event: Event, el: GridItemHTMLElement) {
        this.callback(this.active?.resize ? this.context.onResize : this.context.onDrag, event, el);
        if (this.frame === undefined) {
            this.frame = requestAnimationFrame(() => {
                this.frame = undefined;
                if (this.mounted) {
                    this.forceUpdate();
                }
            });
        }
    }
    private callback(
        callback: ItemManipulationCallback | undefined,
        event: Event,
        el: GridItemHTMLElement,
    ) {
        if (!this.active || !callback || !el.gridstackNode) {
            return;
        }
        const node = el.gridstackNode;
        const destination = [...this.grids.values()].find(({grid}) => grid === node.grid);
        const item = {
            ...this.active.oldItem,
            ...position(this.active.id, node),
            parent: destination?.parent,
            containerId: destination?.containerId,
            minW: node.minW,
            minH: node.minH,
            maxW: node.maxW,
            maxH: node.maxH,
        };
        const key = this.active.sourceKey;
        const record = this.grids.get(key);
        const placeholder =
            event.type === 'drag' || event.type === 'resize'
                ? {...position(this.active.id, node), placeholder: true}
                : null;
        const data = {
            group: key.startsWith('zone:') ? key.slice(5) : record?.parent || DEFAULT_GROUP,
            layout: this.readDocument()
                .layout.filter((entry) => getGridKey(entry) === key)
                .map((entry) => ({
                    ...this.context.layout.find(({i}) => i === entry.i),
                    ...entry,
                })),
            oldItem: this.active.oldItem,
            newItem: item,
            // Legacy runtime sends null at start/stop although its public callback type omits null.
            placeholder: placeholder as Parameters<ItemManipulationCallback>[0]['placeholder'],
            e: event as MouseEvent,
            element: el,
        };
        callback(data);
    }
    private finish(event: Event, el: GridItemHTMLElement) {
        if (!this.active || this.finishQueued) {
            return;
        }
        this.finishQueued = true;
        Promise.resolve().then(() => {
            this.finishQueued = false;
            if (!this.mounted || !this.active) {
                return;
            }
            try {
                this.finishGesture(event, el);
            } finally {
                for (const {grid} of this.grids.values()) {
                    (grid.engine as DashKitEngine).dropSize = undefined;
                }
                this.active = undefined;
                this.forceUpdate();
            }
        });
    }
    private finishGesture(event: Event, el: GridItemHTMLElement) {
        const active = requireValue(this.active, 'active gesture');
        const host = this.hosts.get(active.id);
        if (host?.el.gridstackNode) {
            this.membership(host);
        }
        if (active.cancelled) {
            this.sync();
            this.callback(
                active.resize ? this.context.onResizeStop : this.context.onDragStop,
                event,
                el,
            );
            return;
        }
        if (host) {
            const record = requireValue(this.grids.get(host.key), 'host grid record');
            if (host.key !== active.sourceKey && host.el.gridstackNode) {
                const source = requireValue(
                    this.grids.get(active.sourceKey),
                    'gesture source grid',
                );
                record.grid.update(
                    host.el,
                    this.convertConstraints(active.oldItem, source, record),
                );
                record.grid.engine.moveNodeCheck(host.el.gridstackNode, {
                    w: Math.max(
                        1,
                        Math.round((active.width + record.geometry.gapX) / record.geometry.stepX),
                    ),
                    h: Math.max(
                        1,
                        Math.round((active.height + record.geometry.gapY) / record.geometry.stepY),
                    ),
                    resizing: true,
                });
            }
        }
        let document: ReturnType<GridStackCanvas['readDocument']>;
        try {
            document = this.readDocument();
            const {layout, containers} = document;
            const config = {
                ...this.context.config,
                layout,
                ...(containers ? {containers, layoutVersion: 2 as const} : {}),
            };
            validateConfig(config, this.context.groups);
            this.validateGeometry(config);
        } catch {
            // A native proposal is rejectable; controlled input still throws before applying it.
            this.sync();
            this.callback(
                active.resize ? this.context.onResizeStop : this.context.onDragStop,
                event,
                el,
            );
            return;
        }
        const {layout, containers} = document;
        this.context.layoutChange(layout, containers);
        this.callback(
            active.resize ? this.context.onResizeStop : this.context.onDragStop,
            event,
            el,
        );
        const affected = new Set([active.sourceKey, host?.key]);
        affected.forEach((key) => {
            if (key) {
                this.grids
                    .get(key)
                    ?.properties.onLayoutChange?.(
                        layout.filter((entry) => getGridKey(entry) === key),
                    );
            }
        });
    }
    private membership(hostInput: Host) {
        const host = hostInput;
        const key =
            [...this.grids].find(([, record]) => record.root === host.el.parentElement)?.[0] ||
            host.key;
        host.key = key;
        const record = requireValue(this.grids.get(key), 'grid record');
        return {parent: record.parent, containerId: record.containerId};
    }
    private readDocument() {
        return projectLayoutDocument(this.context.layout, this.context.containers, (id) => {
            const host = this.hosts.get(id);
            const node = host?.el.gridstackNode;
            if (!host || !node) {
                return undefined;
            }
            const {i: _i, ...geometry} = position(id, node);
            return {...geometry, ...this.membership(host)};
        });
    }
    private paletteOver = (event: DragEvent) => {
        const record = [...this.grids.values()].find(({root}) => root === event.currentTarget);
        if (!record || !this.context.dragOverPlugin || !this.context.editMode) {
            this.clearPreview();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const source = this.grids.get(`zone:${record.parent || DEFAULT_GROUP}`) || record;
        const raw = {
            ...this.context.dragOverPlugin.defaultLayout,
            ...this.context.dragProps?.layout,
        };
        const defaults = record.containerId
            ? {
                  w: Math.max(
                      1,
                      Math.round(
                          ((Number.isFinite(raw.w) ? raw.w : source.geometry.cols) *
                              source.geometry.stepX -
                              source.geometry.gapX +
                              record.geometry.gapX) /
                              record.geometry.stepX,
                      ),
                  ),
                  h: Math.max(
                      1,
                      Math.round(
                          (raw.h * source.geometry.stepY -
                              source.geometry.gapY +
                              record.geometry.gapY) /
                              record.geometry.stepY,
                      ),
                  ),
                  ...this.convertConstraints(raw, source, record),
              }
            : undefined;
        if (defaults) {
            if (hasInvertedConstraints(defaults)) {
                this.clearPreview();
                return;
            }
            const {minW = 1, maxW = Infinity, minH = 1, maxH = Infinity} = defaults;
            defaults.w = Math.min(maxW, Math.max(minW, defaults.w));
            defaults.h = Math.min(maxH, Math.max(minH, defaults.h));
        }
        const {layout, containers} = this.readDocument();
        const sizes = this.context.onDropDragOver(
            event as unknown as Parameters<DashKitCtxShape['onDropDragOver']>[0],
            record.parent,
            record.properties,
            [...layout, ...(containers || []).map(({id, ...entry}) => ({i: id, ...entry}))].filter(
                (entry) =>
                    getGridKey(entry) ===
                        (record.containerId
                            ? `container:${record.containerId}`
                            : `zone:${record.parent || DEFAULT_GROUP}`) &&
                    entry.i !== TEMPORARY_ITEM_ID,
            ),
            undefined,
            defaults,
            record.containerId,
        );
        if (sizes === false) {
            this.clearPreview();
            return;
        }
        const entry = this.paletteEntry(record, event, sizes);
        if (!entry) {
            this.clearPreview();
            return;
        }
        if (this.hosts.get(TEMPORARY_ITEM_ID)?.key !== getGridKey(entry)) {
            this.clearPreview();
        }
        const engine = record.grid.engine as DashKitEngine;
        if (!engine.willItFit({id: entry.i, ...entry})) {
            this.clearPreview();
            return;
        }
        if (engine.mode.preventCollision) {
            const bounded = {...entry};
            engine.nodeBoundFix(bounded);
            if (engine.collideAll(bounded, bounded).some(({id}) => id !== TEMPORARY_ITEM_ID)) {
                this.clearPreview();
                return;
            }
        }
        const before = this.renderKey();
        this.preview = {
            id: TEMPORARY_ITEM_ID,
            type: this.context.dragOverPlugin.type,
            namespace: 'default',
            data: {},
        };
        const host = this.attach(TEMPORARY_ITEM_ID, entry);
        if (host) {
            record.grid.engine.moveNodeCheck(
                requireValue(host.el.gridstackNode, 'host native node'),
                entry,
            );
        }
        if (before !== this.renderKey()) {
            this.forceUpdate();
        }
    };
    private paletteEntry(
        record: GridRecord,
        event: DragEvent,
        sizes: Exclude<ReturnType<DashKitCtxShape['onDropDragOver']>, false>,
    ) {
        const rect = record.root.getBoundingClientRect();
        const scaleX = record.root.clientWidth ? rect.width / record.root.clientWidth : 1;
        const scaleY = record.root.clientHeight ? rect.height / record.root.clientHeight : scaleX;
        const entry: ConfigLayout = {
            i: TEMPORARY_ITEM_ID,
            x: Math.max(
                0,
                Math.round((event.clientX - rect.left) / scaleX / record.geometry.stepX),
            ),
            y: Math.max(0, Math.round((event.clientY - rect.top) / scaleY / record.geometry.stepY)),
            w: sizes?.w || 3,
            h: sizes?.h || 3,
            ...(record.parent ? {parent: record.parent} : {}),
            ...(record.containerId ? {containerId: record.containerId} : {}),
        };
        if (record.properties.isBounded) {
            const bounds = this.paletteBounds(record, entry);
            if (bounds.x < 0 || bounds.y < 0) {
                return undefined;
            }
            entry.x = Math.min(entry.x, Math.floor(bounds.x + 1e-7));
            entry.y = Math.min(entry.y, Math.floor(bounds.y + 1e-7));
        }
        return entry;
    }
    private paletteBounds(record: GridRecord, entry: ConfigLayout) {
        const rect = record.root.getBoundingClientRect();
        const scaleX = record.root.clientWidth ? rect.width / record.root.clientWidth : 1;
        const scaleY = record.root.clientHeight ? rect.height / record.root.clientHeight : scaleX;
        const visible = visibleGeometry(entry, record.geometry);
        return {
            x: (rect.width / scaleX - visible.width) / record.geometry.stepX,
            y:
                record.properties.autoSize === false ||
                record.properties.style?.height !== undefined
                    ? (rect.height / scaleY - visible.height) / record.geometry.stepY
                    : Infinity,
        };
    }
    private paletteDrop = (event: DragEvent) => {
        if (!this.preview) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const host = requireValue(this.hosts.get(TEMPORARY_ITEM_ID), 'palette preview host');
        const record = requireValue(this.grids.get(host.key), 'host grid record');
        const node = requireValue(host.el.gridstackNode, 'host native node');
        const entry = position(TEMPORARY_ITEM_ID, node);
        const bounds = record.properties.isBounded ? this.paletteBounds(record, entry) : undefined;
        if (
            (bounds && (entry.x > bounds.x + 1e-7 || entry.y > bounds.y + 1e-7)) ||
            (record.grid.engine.maxRow &&
                requireValue(node.y, 'node.y') + requireValue(node.h, 'node.h') >
                    record.grid.engine.maxRow) ||
            requireValue(node.x, 'node.x') + requireValue(node.w, 'node.w') >
                record.grid.engine.column
        ) {
            this.clearPreview();
            return;
        }
        const item = {
            ...position(
                record.properties.droppingItem?.i || TEMPORARY_ITEM_ID,
                requireValue(host.el.gridstackNode, 'host native node'),
            ),
            ...this.membership(host),
        };
        const preview = this.preview;
        try {
            const {layout, containers} = this.readDocument();
            // Native listeners can synchronously render the pending controlled drop in React 17.
            this.preview = undefined;
            this.context.onDrop(layout, item, event as unknown as MouseEvent, containers);
        } catch (error) {
            this.preview = preview;
            this.clearPreview();
            throw error;
        }
    };
    private paletteLeave = (event: DragEvent) => {
        const root = event.currentTarget as HTMLElement;
        // WebKit can emit a null relatedTarget when the preview appears beneath the pointer.
        const over = document.elementFromPoint(event.clientX, event.clientY);
        if (!over || !root.contains(over)) {
            this.clearPreview();
        }
    };
    private clearPreview = () => {
        if (!this.preview) {
            return;
        }
        const host = this.hosts.get(TEMPORARY_ITEM_ID);
        if (host) {
            const grid = this.grids.get(host.key)?.grid;
            if (grid) {
                const engine = grid.engine as DashKitEngine;
                const restoring = engine.restoring;
                engine.restoring = true;
                try {
                    grid.removeWidget(host.el, false, false);
                } finally {
                    engine.restoring = restoring;
                }
            }
            host.el.remove();
            this.hosts.delete(TEMPORARY_ITEM_ID);
        }
        this.preview = undefined;
        // Reconcile against current saved/temporary edits, never the collision-shifted preview.
        this.sync();
        if (this.mounted) {
            this.forceUpdate();
        }
    };
    private adjustWidgetLayout = ({
        widgetId,
        needSetDefault,
        adjustedWidgetLayout,
    }: {
        widgetId: string;
        needSetDefault?: boolean;
        adjustedWidgetLayout?: WidgetLayout;
    }) => {
        if (needSetDefault) {
            this.autoHeightItems.delete(widgetId);
            this.context.revertToOriginalLayout(widgetId);
        } else if (adjustedWidgetLayout) {
            const entry = this.context.layout.find(({i}) => i === widgetId);
            if (entry) {
                const adjusted = {...adjustedWidgetLayout};
                if (entry.containerId) {
                    const remaining =
                        requireValue(
                            this.getProperties(getGridKey(entry)).maxRows,
                            'containing grid row capacity',
                        ) - entry.y;
                    adjusted.h = Math.min(adjusted.h, remaining);
                    if (adjusted.minH !== undefined) {
                        adjusted.minH = Math.min(adjusted.minH, adjusted.h);
                    }
                    if (adjusted.maxH !== undefined) {
                        adjusted.maxH = Math.min(adjusted.maxH, remaining);
                    }
                }
                this.autoHeightItems.add(widgetId);
                if (!isEqual(entry, adjusted)) {
                    this.context.memorizeOriginalLayout(widgetId, {...entry}, adjusted);
                }
            }
        }
    };
    private renderItem(
        item: ConfigItem,
        propertiesByGrid: Map<string, ReactGridLayoutProps>,
        placeholder = false,
    ) {
        const host = this.hosts.get(item.id);
        const node = host?.el.gridstackNode || this.context.layout.find(({i}) => i === item.id);
        const record = host && (this.grids.get(host.key) || host.lastRecord);
        if (!host || !node || !record) {
            return null;
        }
        const measured = visibleGeometry(position(item.id, node), record.geometry);
        const active = this.active?.id === item.id ? this.active : undefined;
        const {width, height} = active && !active.resize ? active : measured;
        const props = propertiesByGrid.get(host.key) || record.properties;
        if (!this.pluginCallbacks.has(item.id)) {
            this.pluginCallbacks.set(item.id, (value) => {
                if (value) {
                    this.plugins.set(item.id, value);
                } else {
                    this.plugins.delete(item.id);
                }
            });
        }
        return createPortal(
            <GridItem
                id={item.id}
                className={Object.entries({
                    'react-grid-item': true,
                    cssTransforms: props.useCSSTransforms !== false,
                    'react-draggable': props.isDraggable ?? this.context.editMode,
                    'react-resizable':
                        (props.isResizable ?? this.context.editMode) &&
                        props.resizeHandles?.length !== 0,
                    resizing: active?.resize,
                    'react-draggable-dragging': active?.resize === false,
                })
                    .filter(([, enabled]) => enabled)
                    .map(([name]) => name)
                    .join(' ')}
                item={item}
                style={{width, height}}
                fillParent
                layoutTransform={
                    props.useCSSTransforms === false
                        ? undefined
                        : `translate(${measured.left}px, ${measured.top}px)`
                }
                layout={this.context.layout}
                gridLayout={props}
                isDragging={Boolean(active)}
                isPlaceholder={placeholder}
                forwardedPluginRef={this.pluginCallbacks.get(item.id)}
                adjustWidgetLayout={this.adjustWidgetLayout}
                noOverlay={props.noOverlay ?? this.context.noOverlay}
                focusable={this.context.focusable}
                withCustomHandle={Boolean(this.context.draggableHandleClassName)}
                onItemFocus={(focusedItem) => {
                    host.el.classList.add('dashkit-grid-item_is-focused');
                    this.context.onItemFocus?.(focusedItem);
                }}
                onItemBlur={(blurredItem) => {
                    host.el.classList.remove('dashkit-grid-item_is-focused');
                    this.context.onItemBlur?.(blurredItem);
                }}
                onItemMountChange={this.context.onItemMountChange}
                onItemRender={this.context.onItemRender}
                data-dashkit-grid-cols={String(props.cols || 36)}
                data-dashkit-grid-x={String(node.x)}
                data-dashkit-grid-y={String(node.y)}
                data-dashkit-grid-w={String(node.w)}
                data-dashkit-grid-h={String(node.h)}
                data-dashkit-grid-row-height={String(props.rowHeight ?? 18)}
                data-dashkit-grid-margin-x={String(record.geometry.gapX)}
                data-dashkit-grid-margin-y={String(record.geometry.gapY)}
                data-dashkit-grid-padding-x={String(record.geometry.paddingX)}
                data-dashkit-grid-padding-y={String(record.geometry.paddingY)}
                data-dashkit-grid-use-css-transforms={String(props.useCSSTransforms !== false)}
            />,
            host.content,
            item.id,
        );
    }
}

export function GridStackLayout() {
    const context = React.useContext(DashKitContext);
    const canvas = React.useRef<GridStackCanvas>(null);
    const mobile = React.useRef<MobileLayout>(null);
    React.useImperativeHandle(
        context.forwardedMetaRef,
        () => ({
            getItemsMeta: () =>
                canvas.current?.getItemsMeta() ||
                context.getItemsMeta(mobile.current?.pluginsRefs || []),
            reloadItems: (options?: {targetIds?: string[]; force?: boolean}) =>
                canvas.current?.reloadItems(options),
        }),
        [context],
    );
    return context.registerManager.settings.isMobile ? (
        <MobileLayout ref={mobile} data-dashkit-engine="gridstack" />
    ) : (
        <GridStackCanvas ref={canvas} />
    );
}
