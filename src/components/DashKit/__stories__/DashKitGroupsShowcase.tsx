import React from 'react';

import {
    ArrowDown,
    ArrowUp,
    ChartColumn,
    ChevronDown,
    ChevronUp,
    Copy,
    Heading,
    Pin,
    Sliders,
    TextAlignLeft,
    TrashBin,
} from '@gravity-ui/icons';
import {Button, Disclosure, Icon} from '@gravity-ui/uikit';

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
import {cn} from '../../../utils/cn';

import {Demo, DemoRow} from './Demo';
import {fixedGroup, getConfig} from './utils';

import './DashKitShowcase.scss';

const b = cn('stories-dashkit-showcase');

const MAX_ROWS = 2;
const GRID_COLUMNS = 36;

function arrayMove(arr: string[], oldIndex: number, newIndex: number) {
    const copy = [...arr];
    const item = copy[oldIndex];
    copy[oldIndex] = copy[newIndex];
    copy[newIndex] = item;

    return copy;
}

export const DashKitGroupsShowcase: React.FC = () => {
    const [editMode, setEditMode] = React.useState(true);
    const [headerInteractions, setHeaderInteractions] = React.useState(true);
    const [chartGroups, setChartGroups] = React.useState<string[]>(['1_group', '2_group']);

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
                    const overrideProps: ReactGridLayoutProps = {
                        ...props,
                        compactType: 'horizontal-nowrap',
                        maxRows: MAX_ROWS,
                    };

                    if (headerInteractions) {
                        return overrideProps;
                    }

                    return {
                        ...overrideProps,
                        noOverlay: true,
                        isResizable: false,
                        isDraggable: false,
                        resizeHandles: [],
                    };
                },
            },
            ...chartGroups.map((id) => ({
                id,
                render: (id: string, children: React.ReactNode, props: DashkitGroupRenderProps) => {
                    const itemsLength = props.items.length;
                    const showPlaceholder = itemsLength === 0 && !props.isDragging;

                    const isMultipleGroups = chartGroups.length > 1;
                    const groupIndex = chartGroups.indexOf(id);
                    const hasNext = isMultipleGroups && groupIndex < chartGroups.length - 1;
                    const hasPrev = isMultipleGroups && groupIndex > 0;

                    return (
                        <Disclosure
                            className={b('collapse-group')}
                            key={`key_${id}`}
                            defaultExpanded={true}
                            keepMounted={true}
                        >
                            <div
                                key={id}
                                className={b('collapse-group-grid', {
                                    ['edit-mode']: props.editMode,
                                })}
                            >
                                {showPlaceholder ? (
                                    <div className={b('collapse-group-placeholder')}>
                                        Empty group
                                    </div>
                                ) : (
                                    children
                                )}
                            </div>

                            <Disclosure.Summary>
                                {(props) => (
                                    <div className={b('collapse-group-header')}>
                                        <div className={b('collapse-group-header-action')}>
                                            <Button {...props}>
                                                <Icon
                                                    data={props.expanded ? ChevronUp : ChevronDown}
                                                />
                                                {`${id}: (${itemsLength})`}
                                            </Button>
                                        </div>
                                        <div className={b('collapse-group-header-controls')}>
                                            <Button
                                                onClick={() => {
                                                    setChartGroups((groupOrder) => {
                                                        return arrayMove(
                                                            groupOrder,
                                                            groupIndex,
                                                            groupIndex - 1,
                                                        );
                                                    });
                                                }}
                                                disabled={!hasPrev}
                                                view="flat"
                                                size="l"
                                            >
                                                <Icon data={ArrowUp}></Icon>
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setChartGroups((groupOrder) => {
                                                        return arrayMove(
                                                            groupOrder,
                                                            groupIndex,
                                                            groupIndex + 1,
                                                        );
                                                    });
                                                }}
                                                disabled={!hasNext}
                                                view="flat"
                                                size="l"
                                            >
                                                <Icon data={ArrowDown}></Icon>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Disclosure.Summary>
                        </Disclosure>
                    );
                },
            })),
            {
                id: DEFAULT_GROUP,
                gridProperties: (props: ReactGridLayoutProps) => {
                    return {
                        ...props,
                        compactType: null,
                        allowOverlap: true,
                        resizeHandles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'],
                    };
                },
            },
        ],
        [headerInteractions, chartGroups],
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

    const context = React.useMemo(
        () => ({editModeHeader: headerInteractions}),
        [headerInteractions],
    );

    return (
        <DashKitDnDWrapper
            onDragStart={() => {
                console.log('dragStarted');
            }}
            onDragEnd={() => {
                console.log('dragEnded');
            }}
            onDropDragOver={(item) => headerInteractions || item.parent !== fixedGroup}
        >
            <Demo title="Groups">
                <DemoRow title="Controls">
                    <div className={b('controls-line')}>
                        <Button
                            view="action"
                            size="m"
                            className={b('btn-contol')}
                            onClick={() => setEditMode(!editMode)}
                        >
                            {editMode ? 'Disable editMode' : 'Enable editMode'}
                        </Button>
                        <Button
                            view="action"
                            size="m"
                            className={b('btn-contol')}
                            onClick={() => setHeaderInteractions(!headerInteractions)}
                            disabled={!editMode}
                        >
                            {headerInteractions
                                ? 'Disable header interactions'
                                : 'Enable header interactions'}
                        </Button>
                        <Button
                            size="m"
                            className={b('btn-contol')}
                            onClick={() =>
                                setChartGroups((current) => [
                                    ...current,
                                    `${current.length + 1}_group`,
                                ])
                            }
                        >
                            {'Add group'}
                        </Button>
                    </div>
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
                        context={context}
                    />
                    <ActionPanel items={items} />
                </DemoRow>
            </Demo>
        </DashKitDnDWrapper>
    );
};
