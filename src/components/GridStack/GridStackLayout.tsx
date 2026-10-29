import React from 'react';

import isEqual from 'lodash/isEqual';
import {createPortal} from 'react-dom';
import ResizeObserverPolyfill from 'resize-observer-polyfill';

import {DEFAULT_GROUP, DRAGGABLE_CANCEL_CLASS_NAME} from '../../constants/common';
import {DashKitContext} from '../../context';
import type {DashKitCtxShape} from '../../context';
import type {ConfigItem, ConfigLayout} from '../../shared';
import type {
    ItemManipulationCallback,
    PluginRef,
    ReactGridLayoutProps,
    WidgetLayout,
} from '../../typings';
import GridItem from '../GridItem/GridItem';
import MobileLayout from '../MobileLayout/MobileLayout';

import {getGridKey, validateConfig, validateGrid} from './document';
import {DashKitEngine} from './engine';
import {getGridGeometry, visibleGeometry} from './geometry';
import {getGridProperties} from './grid-properties';
import {requireValue} from './invariants';
import {DashKitNativeGrid} from './native-grid';
import {GridStack} from './runtime';
import type {GridItemHTMLElement, GridStackNode, GridStackOptions} from './runtime';

import './GridStack.scss';

interface Host {
    el: GridItemHTMLElement;
    content: HTMLElement;
    key: string;
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

class GridStackCanvas extends React.PureComponent {
    static contextType = DashKitContext;
    declare context: DashKitCtxShape;
    private roots = new Map<string, HTMLElement>();
    private grids = new Map<string, GridRecord>();
    private hosts = new Map<string, Host>();
    private plugins = new Map<string, PluginRef>();
    private pluginCallbacks = new Map<string, (value: PluginRef) => void>();
    private autoheightWidgets = new Set<string>();
    private observer?: ResizeObserver;
    private syncing = false;
    private appliedContext?: DashKitCtxShape;
    private active?: Gesture;
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
            if (!this.active) {
                this.sync();
            }
        });
        this.sync();
        this.reloadItems();
        document.addEventListener('visibilitychange', this.onVisibilityChange);
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
            this.sync();
        }
        if (!this.active && this.appliedContext !== this.context) {
            this.sync();
        }
        clearTimeout(this.timer);
        this.reloadItems();
    }
    componentWillUnmount() {
        this.mounted = false;
        clearTimeout(this.timer);
        if (this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
        }
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.observer?.disconnect();
        for (const host of this.hosts.values()) {
            host.dragObserver?.disconnect();
            delete host.dragObserver;
        }
        [...this.grids.values()].forEach(({grid}) => {
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
            [...this.grids.keys()].map((key) => [key, this.getProperties(key)]),
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
    private onVisibilityChange = () => this.reloadItems();
    private getProperties(key: string) {
        return getGridProperties(key, this.context.registerManager.gridLayout, this.context.groups);
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
            acceptWidgets: false,
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
        // Teardown still needs the applied settings after controlled group roots disappear.
        grid.properties = () => (this.syncing ? record.properties : this.getProperties(key));
        record.parent = key.slice(5) === DEFAULT_GROUP ? undefined : key.slice(5);
        this.grids.set(key, record);
        grid.on('dragstart resizestart', (event: Event, el: GridItemHTMLElement) =>
            this.start(event, el),
        );
        grid.on('drag resize', (event: Event, el: GridItemHTMLElement) => this.move(event, el));
        grid.on('dragstop resizestop', (event: Event, el: GridItemHTMLElement) =>
            this.finish(event, el),
        );
        this.observer?.observe(wrapper);
        return record;
    }
    private syncDragHandle(id: string) {
        const host = this.hosts.get(id);
        if (!host || !this.mounted || this.active) {
            return;
        }
        const custom = this.context.draggableHandleClassName;
        if (!custom && !host.dragObserver) {
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
    private createHost(id: string, key: string): Host {
        const el: GridItemHTMLElement = document.createElement('div');
        el.className = 'grid-stack-item react-grid-item dashkit-gridstack__host';
        el.dataset.dashkitId = id;
        const content = document.createElement('div');
        content.className = 'grid-stack-item-content';
        el.appendChild(content);
        const host = {el, content, key};
        this.hosts.set(id, host);
        return host;
    }
    private attach(id: string, entry: Omit<ConfigLayout, 'i'>) {
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
        const host = previous || this.createHost(id, key);
        host.lastRecord = record;
        if (host.key !== key) {
            this.grids.get(host.key)?.grid.removeWidget(host.el, false, false);
            host.key = key;
        }
        const constraints = entry as Partial<WidgetLayout>;
        const node = {
            id,
            x: entry.x,
            y: entry.y,
            w: entry.w,
            h: entry.h,
            minW: constraints.minW,
            minH: constraints.minH,
            maxW: constraints.maxW,
            maxH: constraints.maxH,
        };
        if (host.el.parentElement !== record.root || host.el.gridstackNode?.grid !== record.grid) {
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
    private sync = () => {
        if (this.syncing || !this.mounted) {
            return;
        }
        this.syncing = true;
        const {configItems, layout} = this.context;
        const before = this.renderKey();
        try {
            const replaced = [...this.grids]
                .filter(
                    ([key, record]) =>
                        this.roots.get(key) !== record.wrapper ||
                        record.wrapper.firstElementChild !== record.root,
                )
                .map(([, record]) => record.root);
            [...this.grids].forEach(([key, record]) => {
                if (
                    replaced.some((root) => root === record.root || root.contains(record.wrapper))
                ) {
                    this.observer?.unobserve(record.wrapper);
                    record.grid.destroy(false);
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
            const activeLayout = layout;
            configItems.forEach((item) => {
                const entry = activeLayout.find(({i}) => i === item.id);
                if (entry) {
                    this.attach(item.id, entry);
                }
            });
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
            const retained = new Set(configItems.map(({id}) => id));
            this.hosts.forEach((host, id) => {
                if (!retained.has(id)) {
                    host.dragObserver?.disconnect();
                    this.grids.get(host.key)?.grid.removeWidget(host.el, false, false);
                    host.el.remove();
                    this.hosts.delete(id);
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
            [...this.grids].forEach(([key, record]) => {
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
        const canMove = properties.isDraggable ?? this.context.editMode;
        const canResize =
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
        });
        record.grid.refreshPositions();
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
    private start(event: Event, el: GridItemHTMLElement) {
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
        if (this.context.focusable) {
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
                this.active = undefined;
                this.forceUpdate();
            }
        });
    }
    private finishGesture(event: Event, el: GridItemHTMLElement) {
        const active = requireValue(this.active, 'active gesture');
        const host = this.hosts.get(active.id);
        if (active.cancelled) {
            this.sync();
        } else {
            const {layout} = this.readDocument();
            try {
                validateConfig({...this.context.config, layout});
            } catch {
                this.sync();
                this.callback(
                    active.resize ? this.context.onResizeStop : this.context.onDragStop,
                    event,
                    el,
                );
                return;
            }
            this.context.layoutChange(layout);
        }
        this.callback(
            active.resize ? this.context.onResizeStop : this.context.onDragStop,
            event,
            el,
        );
        const {layout} = this.readDocument();
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
    private readDocument() {
        return {
            layout: this.context.layout.map((entry) => {
                const node = this.hosts.get(entry.i)?.el.gridstackNode;
                return node ? {...entry, ...position(entry.i, node)} : {...entry};
            }),
        };
    }
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
            this.context.revertToOriginalLayout(widgetId);
        } else if (adjustedWidgetLayout) {
            const entry = this.context.layout.find(({i}) => i === widgetId);
            if (entry) {
                const adjusted = {...adjustedWidgetLayout};
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
