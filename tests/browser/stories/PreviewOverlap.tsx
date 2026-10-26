import React from 'react';

import type {Config, GridStackContainer} from '../../../src/shared';
import type {CompactType} from '../../../src/typings';
import {ActionPanel} from '../../../src/components/ActionPanel/ActionPanel';
import {DashKitDnDWrapper} from '../../../src/components/DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../../../src/components/GridStack/DashKitGridStack';

const type = 'preview-overlap-contract';
DashKitGridStack.reloadPlugins({
    type,
    defaultLayout: {w: 3, h: 2, minW: 1, minH: 1},
    renderer: ({id}) => (
        <div data-contract-widget={id} style={{height: '100%', background: '#dcecff'}}>
            {id}
        </div>
    ),
});

export function PreviewOverlap({
    nested = false,
    allowOverlap = false,
    compactType = null,
}: {
    nested?: boolean;
    allowOverlap?: boolean;
    compactType?: CompactType;
}) {
    const grid = {cols: 12, rowHeight: 40, compactType, allowOverlap, maxRows: 10};
    const container: GridStackContainer = {
        id: 'box',
        x: 0,
        y: 0,
        w: 12,
        h: 10,
        padding: [0, 0, 0, 0],
        gap: [0, 0],
        grid,
    };
    const [config, setConfig] = React.useState<Config>({
        salt: 'preview-overlap',
        counter: 1,
        aliases: {},
        connections: [],
        items: ['a', 'b'].map((id) => ({id, type, namespace: 'default', data: {}})),
        layout: [
            {i: 'a', x: 0, y: 0, w: 4, h: 2, ...(nested ? {containerId: 'box'} : {})},
            {i: 'b', x: 8, y: 0, w: 3, h: 2, ...(nested ? {containerId: 'box'} : {})},
        ],
        ...(nested ? {containers: [container], layoutVersion: 2} : {}),
    });
    const [drops, setDrops] = React.useState(0);
    return (
        <DashKitDnDWrapper>
            <div>
                <ActionPanel items={[{id: 'add', icon: '+', title: 'Add', dragProps: {type}}]} />
                <div style={{width: 600, height: 400}}>
                    <DashKitGridStack
                        config={config}
                        editMode
                        groups={[
                            {
                                gridProperties: () => ({
                                    ...grid,
                                    compactType: nested ? null : compactType,
                                    margin: [0, 0],
                                    containerPadding: [0, 0],
                                    width: 600,
                                    autoSize: false,
                                    style: {height: 400},
                                }),
                            },
                        ]}
                        onChange={({config: next}) => setConfig(next)}
                        onDrop={({newLayout, itemLayout, commit}) => {
                            const id = 'added';
                            setConfig({
                                ...config,
                                items: [
                                    ...config.items,
                                    {id, type, namespace: 'default', data: {}},
                                ],
                                layout: [...newLayout, {...itemLayout, i: id}],
                            });
                            setDrops((count) => count + 1);
                            commit();
                        }}
                    />
                </div>
                <pre data-qa="preview-overlap-config">{JSON.stringify(config)}</pre>
                <span data-qa="preview-overlap-drops">{drops}</span>
            </div>
        </DashKitDnDWrapper>
    );
}
