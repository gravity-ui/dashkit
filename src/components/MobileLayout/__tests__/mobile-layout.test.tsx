/** @jest-environment jsdom */

import React from 'react';

import {render} from '@testing-library/react';

import type {Config} from '../../../shared';
import {DashKit} from '../../DashKit';

const PLUGIN_TYPE = 'mobile-layout-test';

// `config.items[i]` and `config.layout[i]` describe the same widget: the mobile layout
// merges them by index before sorting.
const createConfig = (layout: Array<{i: string; x: number; y: number}>): Config => ({
    salt: 'test',
    counter: layout.length,
    items: layout.map(({i}) => ({id: i, type: PLUGIN_TYPE, namespace: 'default', data: {}})),
    layout: layout.map(({i, x, y}) => ({i, x, y, w: 4, h: 4})),
    aliases: {},
    connections: [],
});

const renderedIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.dashkit-mobile-layout__item')).map(
        (item) => item.textContent,
    );

describe('DashKit in mobile mode', () => {
    beforeAll(() => {
        // The register manager is a module singleton: register the plugin once per file.
        DashKit.registerPlugins({
            type: PLUGIN_TYPE,
            defaultLayout: {w: 4, h: 4},
            renderer: ({id}) => <span>{id}</span>,
        });
        DashKit.setSettings({isMobile: true});
    });

    it('renders the items in one column, sorted by row and then by column', () => {
        const config = createConfig([
            {i: 'right', x: 6, y: 0},
            {i: 'left', x: 0, y: 0},
            {i: 'below', x: 0, y: 4},
        ]);

        const {container} = render(<DashKit config={config} editMode={false} />);

        expect(container.querySelector('.dashkit-mobile-layout')).not.toBeNull();
        expect(container.querySelector('.react-grid-layout')).toBeNull();
        expect(renderedIds(container)).toEqual(['left', 'right', 'below']);
    });

    it('re-sorts the items when the layout changes', () => {
        const {container, rerender} = render(
            <DashKit
                config={createConfig([
                    {i: 'first', x: 0, y: 0},
                    {i: 'second', x: 0, y: 4},
                ])}
                editMode={false}
            />,
        );

        expect(renderedIds(container)).toEqual(['first', 'second']);

        rerender(
            <DashKit
                config={createConfig([
                    {i: 'first', x: 0, y: 8},
                    {i: 'second', x: 0, y: 4},
                ])}
                editMode={false}
            />,
        );

        expect(renderedIds(container)).toEqual(['second', 'first']);
    });
});
