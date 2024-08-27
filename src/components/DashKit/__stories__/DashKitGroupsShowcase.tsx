import React from 'react';

import {cn} from '@bem-react/classname';
import {
    ChartColumn,
    Copy,
    Gear,
    Heading,
    Sliders,
    TextAlignLeft,
    TrashBin,
} from '@gravity-ui/icons';
import {Button, Icon} from '@gravity-ui/uikit';

import {
    ActionPanel,
    DashKit,
    DashKitDnDWrapper,
    DashKitGroup,
    DashKitProps,
    DashkitGroupRenderProps,
    ReactGridLayoutProps,
} from '../../..';
import {DEFAULT_GROUP, MenuItems} from '../../../helpers';
import {i18n} from '../../../i18n';

import {Demo, DemoRow} from './Demo';
import {fixedGroup, getConfig} from './utils';

const b = cn('dashkit-demo');

export const DashKitGroupsShowcase: React.FC = () => {
    const [editMode, setEditMode] = React.useState(true);

    const overlayMenuItems = React.useMemo(() => {
        return [
            {
                id: 'settings',
                title: 'Menu setting text',
                icon: <Icon data={Gear} size={16} />,
            },
            {
                id: MenuItems.Copy,
                title: 'Menu setting copy',
                icon: <Icon data={Copy} size={16} />,
            },
            {
                id: MenuItems.Delete,
                title: i18n('label_delete'), // for language change check
                icon: <Icon data={TrashBin} size={16} />,
                className: 'dashkit-overlay-controls__item_danger',
            },
        ];
    }, []);

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
                    return {...props, compactType: 'horizontal-nowrap', maxRows: 2};
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
                    />
                    <ActionPanel items={items} />
                </DemoRow>
            </Demo>
        </DashKitDnDWrapper>
    );
};
