import React from 'react';

import {ChartColumn, Copy, Heading, Sliders, TextAlignLeft} from '@gravity-ui/icons';
import {Icon} from '@gravity-ui/uikit';

import {ActionPanel, DashKit, DashKitDnDWrapper, DashKitProps} from '../../..';
import {MenuItems} from '../../../helpers';
import {i18n} from '../../../i18n';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';

import {Demo, DemoRow} from './Demo';
import {getConfig} from './utils';

export const DashKitFixedLayout: React.FC = () => {
    React.useEffect(() => {
        DashKit.setSettings({
            menu: [
                {
                    id: 'settings',
                    title: 'Menu setting text',
                    icon: <Icon data={CogIcon} size={16} />,
                },
                {
                    id: MenuItems.Copy,
                    title: 'Menu setting copy',
                    icon: <Icon data={CopyIcon} size={16} />,
                },
                {
                    id: MenuItems.Delete,
                    title: i18n('label_delete'), // for language change check
                    icon: <Icon data={DeleteIcon} size={16} />,
                    className: 'dashkit-overlay-controls__item_danger',
                },
            ],
        });
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

    return (
        <DashKitDnDWrapper>
            <Demo title="Fixed layout example">
                <DemoRow title="Component view">
                    <DashKit editMode={true} config={config} onChange={onChange} onDrop={onDrop} />
                    <ActionPanel items={items} />
                </DemoRow>
            </Demo>
        </DashKitDnDWrapper>
    );
};
