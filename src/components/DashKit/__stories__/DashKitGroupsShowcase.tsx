import React from 'react';

import {cn} from '@bem-react/classname';
import {ChartColumn, Copy, Heading, Pin, Sliders, TextAlignLeft, TrashBin} from '@gravity-ui/icons';
import {Button, Icon} from '@gravity-ui/uikit';

import {
    ActionPanel,
    ConfigItem,
    ConfigLayout,
    DashKit,
    DashKitDnDWrapper,
    DashKitGroup,
    DashKitProps,
    DashkitGroupRenderProps,
    ItemManipulationCallback,
    ReactGridLayoutProps,
} from '../../..';
import {DEFAULT_GROUP, MenuItems} from '../../../helpers';
import {i18n} from '../../../i18n';

import {Demo, DemoRow} from './Demo';
import {fixedGroup, getConfig} from './utils';

const b = cn('dashkit-demo');

const MAX_ROWS = 2;
const GRID_COLUMNS = 36;

export const DashKitGroupsShowcase: React.FC = () => {
    const [editMode, setEditMode] = React.useState(true);

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
    const [config, setConfig] = React.useState(getConfig(true));

    const onChange = React.useCallback(({config}: {config: DashKitProps['config']}) => {
        setConfig(config);
    }, []);

    const groups = React.useMemo<DashKitGroup[]>(
        () => [
            {
                id: fixedGroup,
                render: (id: string, children: React.ReactNode, props: DashkitGroupRenderProps) => {
                    return (
                        <div
                            key={id}
                            className={b('inline-group', {['edit-mode']: props.editMode})}
                        >
                            {children}
                        </div>
                    );
                },
                gridProperties: (props: ReactGridLayoutProps) => {
                    return {
                        ...props,
                        compactType: 'horizontal-nowrap',
                        maxRows: MAX_ROWS,
                        noOverlay: true,
                    };
                },
            },
            {
                id: DEFAULT_GROUP,
                gridProperties: (props: ReactGridLayoutProps) => {
                    const copy = {...props};

                    return {
                        ...copy,
                        compactType: null,
                        allowOverlap: true,
                        resizeHandles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'],
                    };
                },
            },
        ],
        [],
    );

    const overlayMenuItems = React.useMemo(() => {
        const layoutById = config.layout.reduce<Record<string, ConfigLayout>>((memo, item) => {
            memo[item.i] = item;
            return memo;
        }, {});
        const maxOffset = config.layout
            .filter(({parent}) => parent === fixedGroup)
            .reduce((offset, {x, w}) => Math.max(offset, x + w), 0);
        const maxWidth = GRID_COLUMNS - maxOffset;

        const changeParent = (item: ConfigItem) => {
            const itemId = item.id;
            const layoutItem = config.layout.find(({i}) => i === itemId);

            if (!layoutItem) {
                return;
            }

            const copyItem = {
                ...layoutItem,
            };
            const fromParent = layoutItem.parent;

            if (fromParent) {
                delete copyItem.parent;
                copyItem.x = 0;
                copyItem.y = 0;
            } else {
                copyItem.parent = fixedGroup;
                copyItem.x = maxOffset;
                copyItem.y = 0;
                copyItem.h = MAX_ROWS;
            }

            setConfig({
                ...config,
                layout: DashKit.reflowLayout({
                    newLayoutItem: copyItem,
                    layout: config.layout.filter(({i}) => i !== itemId),
                    groups,
                }),
            });
        };

        const controls: DashKitProps['overlayMenuItems'] = [
            {
                id: 'unpin-item',
                title: 'Unpin',
                icon: <Icon data={Pin} size={16} />,
                visible: (item) => Boolean(layoutById[item.id]?.parent),
                handler: changeParent,
            },
            {
                id: 'pin-item',
                title: 'Pin',
                icon: <Icon data={Pin} size={16} />,
                visible: (item) => {
                    const layoutItem = layoutById[item.id];

                    return !layoutItem?.parent && layoutItem.w <= maxWidth;
                },
                handler: changeParent,
            },
            {
                id: MenuItems.Delete,
                title: i18n('label_delete'), // for language change check
                icon: <Icon data={TrashBin} size={16} />,
                className: 'dashkit-overlay-controls__item_danger',
            },
        ];

        return controls;
    }, [config, groups, setConfig]);

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
                    groups,
                });
                setConfig(newConfig);
            }

            dropProps.commit();
        },
        [config, groups],
    );

    const updateConfigOrder = React.useCallback<ItemManipulationCallback>(
        (eventProps) => {
            const index = config.items.findIndex((item) => item.id === eventProps.newItem.i);

            const copyItems = [...config.items];
            copyItems.push(copyItems.splice(index, 1)[0]);

            const copyLyaout = [...config.layout];
            copyLyaout.push(copyLyaout.splice(index, 1)[0]);

            setConfig({
                ...config,
                items: copyItems,
                layout: copyLyaout,
            });
        },
        [config],
    );

    return (
        <DashKitDnDWrapper
            onDragStart={() => {
                console.log('dragStarted');
            }}
            onDragEnd={() => {
                console.log('dragEnded');
            }}
        >
            <Demo title="Groups">
                <DemoRow title="Controls">
                    <Button view="action" size="m" onClick={() => setEditMode(!editMode)}>
                        {editMode ? 'Disable editMode' : 'Enable editMode'}
                    </Button>
                </DemoRow>
                <DemoRow title="Component view">
                    <DashKit
                        editMode={editMode}
                        groups={groups}
                        config={config}
                        onChange={onChange}
                        onDrop={onDrop}
                        overlayMenuItems={overlayMenuItems}
                        onDragStart={updateConfigOrder}
                        onResizeStart={updateConfigOrder}
                    />
                    <ActionPanel items={items} />
                </DemoRow>
            </Demo>
        </DashKitDnDWrapper>
    );
};
