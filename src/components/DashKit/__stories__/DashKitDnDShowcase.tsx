import React from 'react';

import {ChartColumn, Copy, Heading, Sliders, TextAlignLeft} from '@gravity-ui/icons';
import {Icon} from '@gravity-ui/uikit';

import {ActionPanel, DashKit, DashKitDnDWrapper, DashKitProps} from '../../..';

import {Demo, DemoRow} from './Demo';
import {getConfig} from './utils';

export const DashKitDnDShowcase: React.FC = () => {
    const onClick = () => {
        console.log('click');
    };

    const items = React.useMemo(
        () => [
            {
                id: 'chart',
                icon: <Icon data={ChartColumn} />,
                title: 'Chart',
                className: 'test',
                qa: 'chart',
                dragProps: {
                    type: 'custom',
                },
                onClick,
            },
            {
                id: 'selector',
                icon: <Icon data={Sliders} />,
                title: 'Selector',
                qa: 'selector',
                dragProps: {
                    type: 'custom',
                },
                onClick,
            },
            {
                id: 'text',
                icon: <Icon data={TextAlignLeft} />,
                title: 'Text',
                dragProps: {
                    type: 'text',
                },
                onClick,
            },
            {
                id: 'header',
                icon: <Icon data={Heading} />,
                title: 'Header',
                dragProps: {
                    type: 'title',
                },
                onClick,
            },
            {
                id: 'custom',
                icon: <Icon data={Copy} />,
                title: 'Custom',
                dragProps: {
                    type: 'title',
                    layout: {
                        h: 10,
                        w: 36,
                    },
                },
                onClick,
            },
        ],
        [],
    );
    const [config, setConfig] = React.useState(getConfig());

    const onChange = React.useCallback(({config}: {config: DashKitProps['config']}) => {
        setConfig(config);
    }, []);

    const onDrop = React.useCallback<Exclude<DashKitProps['onDrop'], undefined>>(
        (dropProps) => {
            let data = null;
            const type = dropProps.dragProps?.type;
            if (type === 'custom') {
                data = {};
            } else {
                const text = prompt('Enter text');
                if (text) {
                    data =
                        type === 'title'
                            ? {
                                  size: 'm',
                                  text,
                                  showInTOC: true,
                              }
                            : {text};
                }
            }

            if (data) {
                const newConfig = DashKit.setItem({
                    item: {
                        data,
                        type,
                        namespace: 'default',
                        layout: dropProps.itemLayout,
                    },
                    config,
                    options: {
                        updateLayout: dropProps.newLayout,
                    },
                });
                setConfig(newConfig);
            }

            dropProps.commit();
        },
        [config],
    );

    const onDragStart = React.useCallback(() => {
        console.log('dragStarted');
    }, []);

    const onDragEnd = React.useCallback(() => {
        console.log('dragEnded');
    }, []);

    const onItemMountChange = React.useCallback<
        Exclude<DashKitProps['onItemMountChange'], undefined>
    >((item, state) => {
        console.log('onItemMountChange', item, state);
    }, []);

    const onItemRender = React.useCallback<Exclude<DashKitProps['onItemRender'], undefined>>(
        (item) => {
            console.log('onItemRender', item);
        },
        [],
    );

    return (
        <DashKitDnDWrapper onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <Demo title="Drag'n'Drop example">
                <DemoRow title="Component view">
                    <DashKit
                        editMode={true}
                        config={config}
                        overlayControls={null}
                        onChange={onChange}
                        onDrop={onDrop}
                        onItemMountChange={onItemMountChange}
                        onItemRender={onItemRender}
                    />
                    <ActionPanel items={items} />
                </DemoRow>
            </Demo>
        </DashKitDnDWrapper>
    );
};
