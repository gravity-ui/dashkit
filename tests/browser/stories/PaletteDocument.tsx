import React from 'react';

import {ActionPanel} from '../../../src/components/ActionPanel/ActionPanel';
import {DashKitDnDWrapper} from '../../../src/components/DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../../../src/gridstack';
import type {Config, ItemDropProps} from '../../../src/shared';
import type {DashKitGroup, ReactGridLayoutProps} from '../../../src/typings';

const type = 'palette-document';
function Child({id}: {id: string}) {
    const [identity] = React.useState(() => Math.random().toString(36));
    const renders = React.useRef(0);
    return (
        <div
            data-palette-child={id}
            data-identity={identity}
            data-palette-renders={++renders.current}
        >
            {id}
        </div>
    );
}
DashKitGridStack.reloadPlugins({
    type,
    defaultLayout: {w: 3, h: 2},
    renderer: ({id}) => <Child id={id} />,
});
const groups: DashKitGroup[] = [
    {
        gridProperties: () => ({
            cols: 12,
            rowHeight: 40,
            margin: [0, 0],
            containerPadding: [0, 0],
            compactType: null,
            allowOverlap: false,
            autoSize: false,
            maxRows: 10,
            style: {height: 400},
        }),
    },
];

export function PaletteDocument({
    admission = false,
    rerenderOnHover = false,
    rejectAfterHover = false,
    bounded = false,
    scale = 1,
    gap = 0,
    autoHeight = false,
    empty = false,
    callerId = false,
    overlay = false,
    native = false,
}: {
    admission?: boolean;
    rerenderOnHover?: boolean;
    rejectAfterHover?: boolean;
    bounded?: boolean;
    scale?: number;
    gap?: number;
    autoHeight?: boolean;
    empty?: boolean;
    callerId?: boolean;
    overlay?: boolean;
    native?: boolean;
}) {
    const canvasGroups = React.useMemo(
        () =>
            groups.map((group) => ({
                ...group,
                gridProperties: (props: ReactGridLayoutProps) => ({
                    ...group.gridProperties?.(props),
                    ...(autoHeight ? {autoSize: true, style: undefined} : {}),
                    ...(native ? {allowOverlap: true} : {}),
                    ...(callerId ? {droppingItem: {i: 'caller-preview-id', w: 3, h: 2}} : {}),
                    ...(bounded
                        ? {isBounded: true, maxRows: 100, margin: [gap, gap] as [number, number]}
                        : {}),
                }),
            })),
        [bounded, gap, autoHeight, callerId, native],
    );
    const [config, setConfig] = React.useState<Config>(
        empty
            ? {salt: 'palette', counter: 1, aliases: {}, connections: [], items: [], layout: []}
            : admission
              ? {
                    salt: 'palette',
                    counter: 1,
                    aliases: {},
                    connections: [],
                    layoutVersion: 2,
                    items: native ? [{id: 'existing', type, namespace: 'default', data: {}}] : [],
                    layout: native ? [{i: 'existing', x: 0, y: 5, w: 2, h: 2}] : [],
                    containers: ['blocked', 'allowed'].map((id, index) => ({
                        id,
                        x: index * 6,
                        y: 0,
                        w: 5,
                        h: 4,
                        padding: [0, 0, 0, 0],
                        gap: [0, 0],
                        grid: {cols: 5, rowHeight: 40, compactType: null},
                    })),
                }
              : {
                    salt: 'palette',
                    counter: 1,
                    aliases: {},
                    connections: [],
                    layoutVersion: 2,
                    items: [{id: 'child', type, namespace: 'default', data: {}}],
                    layout: [{i: 'child', containerId: 'inner', x: 1, y: 0, w: 1, h: 1}],
                    containers: [
                        {
                            id: 'box',
                            x: 4,
                            y: 0,
                            w: 4,
                            h: 4,
                            padding: [0, 0, 0, 0],
                            gap: [0, 0],
                            grid: {cols: 4, rowHeight: 40, compactType: null},
                        },
                        {
                            id: 'inner',
                            containerId: 'box',
                            x: 1,
                            y: 1,
                            w: 2,
                            h: 2,
                            padding: [0, 0, 0, 0],
                            gap: [0, 0],
                            grid: {cols: 2, rowHeight: 40, compactType: null},
                        },
                    ],
                },
    );
    const [pending, setPending] = React.useState<ItemDropProps>();
    const [drops, setDrops] = React.useState(0);
    const [changes, setChanges] = React.useState(0);
    const [hovers, setHovers] = React.useState(0);
    const [dropHovers, setDropHovers] = React.useState(0);
    const admissionTarget = React.useRef<HTMLSpanElement>(null);
    return (
        <DashKitDnDWrapper
            onDropDragOver={(item) => {
                if (rerenderOnHover) {
                    setHovers((count) => count + 1);
                    return !rejectAfterHover || hovers === 0;
                }
                if (admission) {
                    admissionTarget.current?.setAttribute(
                        'data-container-id',
                        item.containerId || '',
                    );
                    return item.containerId === 'allowed';
                }
                return true;
            }}
        >
            <div style={{paddingTop: 100}}>
                <ActionPanel
                    items={[
                        {
                            id: 'add',
                            icon: '+',
                            title: 'Add',
                            dragProps: {type, ...(autoHeight ? {layout: {w: 3, h: 6}} : {})},
                        },
                    ]}
                />
                <button
                    disabled={!pending}
                    onClick={() => {
                        if (!pending) {
                            return;
                        }
                        setConfig(
                            DashKitGridStack.setItem({
                                config: {
                                    ...config,
                                    ...(pending.containers ? {containers: pending.containers} : {}),
                                },
                                groups: canvasGroups,
                                item: {type, data: {}, layout: pending.itemLayout},
                                options: {updateLayout: pending.newLayout},
                            }),
                        );
                        pending.commit();
                        setPending(undefined);
                    }}
                >
                    Apply drop
                </button>
                <button
                    disabled={!pending}
                    onClick={() => {
                        pending?.commit();
                        setPending(undefined);
                    }}
                >
                    Cancel drop
                </button>
                <div
                    style={{
                        width: 600,
                        height: 400,
                        position: 'relative',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                    }}
                    className={autoHeight ? 'palette-autoheight-review' : undefined}
                >
                    {autoHeight && (
                        <style>{'.palette-autoheight-review .grid-stack {min-height: 40px}'}</style>
                    )}
                    {overlay && (
                        <div
                            data-palette-overlay
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: 120,
                                height: 120,
                                zIndex: 100,
                            }}
                        >
                            Overlay
                        </div>
                    )}
                    <DashKitGridStack
                        config={config}
                        groups={canvasGroups}
                        context={rerenderOnHover ? {hovers} : undefined}
                        editMode
                        onDrop={(drop) => {
                            setPending(drop);
                            setDrops((count) => count + 1);
                            setDropHovers(hovers);
                        }}
                        onChange={({config: next}) => {
                            setConfig(next);
                            setChanges((count) => count + 1);
                        }}
                    />
                </div>
                <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
                <pre data-qa="drop-layout">{JSON.stringify(pending?.itemLayout)}</pre>
                <span data-qa="drop-count">{drops}</span>
                <span data-qa="change-count">{changes}</span>
                <span data-qa="hover-count">{hovers}</span>
                <span data-qa="drop-hover-count">{dropHovers}</span>
                {admission && <span ref={admissionTarget} data-qa="admission-target" />}
            </div>
        </DashKitDnDWrapper>
    );
}
