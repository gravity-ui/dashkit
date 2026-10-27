import React from 'react';

import {ActionPanel} from '../../../src/components/ActionPanel/ActionPanel';
import {DashKitDnDWrapper} from '../../../src/components/DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../../../src/gridstack';
import type {Config, ItemDropProps} from '../../../src/shared';
import type {DashKitGroup} from '../../../src/typings';

const type = 'palette-document';
function Child({id}: {id: string}) {
    const [identity] = React.useState(() => Math.random().toString(36));
    return (
        <div data-palette-child={id} data-identity={identity}>
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

export function PaletteDocument() {
    const [config, setConfig] = React.useState<Config>({
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
    });
    const [pending, setPending] = React.useState<ItemDropProps>();
    const [drops, setDrops] = React.useState(0);
    const [changes, setChanges] = React.useState(0);
    return (
        <DashKitDnDWrapper>
            <div style={{paddingTop: 100}}>
                <ActionPanel items={[{id: 'add', icon: '+', title: 'Add', dragProps: {type}}]} />
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
                                groups,
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
                <div style={{width: 600, height: 400}}>
                    <DashKitGridStack
                        config={config}
                        groups={groups}
                        editMode
                        onDrop={(drop) => {
                            setPending(drop);
                            setDrops((count) => count + 1);
                        }}
                        onChange={({config: next}) => {
                            setConfig(next);
                            setChanges((count) => count + 1);
                        }}
                    />
                </div>
                <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
                <span data-qa="drop-count">{drops}</span>
                <span data-qa="change-count">{changes}</span>
            </div>
        </DashKitDnDWrapper>
    );
}
