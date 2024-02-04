import React from 'react';
import {Icon} from '@gravity-ui/uikit';
import {ChartColumn, Heading, Sliders, TextAlignLeft} from '@gravity-ui/icons';

import {Demo, DemoRow} from './Demo';
import {getConfig} from './utils';
import {DashKit, ActionPanel, MenuItems, DashKitDnDWrapper, DashKitProps} from '../../..';
import i18n from '../../../i18n';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';

export const DashKitDnDShowcase: React.FC = () => {
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

    const items = React.useMemo(
        () => [
            {
                id: 'chart',
                icon: <Icon data={ChartColumn} />,
                title: 'Chart',
                className: 'test',
                qa: 'chart',
                pluginType: 'custom',
            },
            {
                id: 'selector',
                icon: <Icon data={Sliders} />,
                title: 'Selector',
                qa: 'selector',
                pluginType: 'custom',
            },
            {
                id: 'text',
                icon: <Icon data={TextAlignLeft} />,
                title: 'Text',
                pluginType: 'text',
            },
            {
                id: 'header',
                icon: <Icon data={Heading} />,
                title: 'Header',
                pluginType: 'title',
            },
        ],
        [],
    );
    const [config, setConfig] = React.useState(getConfig());
    // TODO fix any
    const onChange = React.useCallback(({config}: {config: DashKitProps['config']}) => {
        setConfig(config);
    }, []);

    const onDrop = React.useCallback(
        // TODO fix any
        (dropProps: any) => {
            let data = null;
            if (dropProps.pluginType === 'custom') {
                data = {};
            } else {
                const text = prompt('Enter text');
                if (text) {
                    data =
                        dropProps.pluginType === 'title'
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
                        namespace: 'default',
                        type: dropProps.pluginType,
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
        <>
            <DashKitDnDWrapper>
                <Demo title="Drag'n'Drop example">
                    <DemoRow title="Component view">
                        <ActionPanel items={items} />
                        <DashKit
                            editMode={true}
                            config={config}
                            onChange={onChange}
                            onDrop={onDrop}
                        />
                    </DemoRow>
                </Demo>
            </DashKitDnDWrapper>
        </>
    );
};
