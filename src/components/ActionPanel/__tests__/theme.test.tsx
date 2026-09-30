/** @jest-environment jsdom */

import {readFileSync} from 'fs';
import {join} from 'path';

import React from 'react';

import {ThemeProvider} from '@gravity-ui/uikit';
import {render} from '@testing-library/react';
// Sass 1.53 does not expose its bundled declarations through TS bundler resolution.
// @ts-expect-error sass declarations are not resolvable with moduleResolution: bundler
import * as sass from 'sass';

import {ActionPanel} from '../ActionPanel';

it('uses the nearest theme provider instead of an outer light theme', () => {
    const stylesheet = document.createElement('style');
    const scss = readFileSync(join(__dirname, '../ActionPanel.scss'), 'utf8');
    stylesheet.textContent = sass.compileString(scss).css;
    document.head.appendChild(stylesheet);

    const {container, rerender} = render(
        <ThemeProvider theme="light" scoped>
            <ThemeProvider theme="dark" scoped>
                <ActionPanel items={[]} />
            </ThemeProvider>
        </ThemeProvider>,
    );

    const panel = container.querySelector('.dashkit-action-panel') as HTMLElement;
    expect(panel.classList.contains('dashkit-action-panel_theme_dark')).toBe(true);
    const darkStyles = getComputedStyle(panel);
    expect(darkStyles.getPropertyValue('--_--dashkit-action-panel-default-color')).toBe(
        '#595959cc',
    );
    expect(
        darkStyles.getPropertyValue('--_--dashkit-action-panel-default-item-dragging-color'),
    ).toBe('#595959');

    rerender(
        <ThemeProvider theme="light" scoped>
            <ThemeProvider theme="light-hc" scoped>
                <ActionPanel items={[]} />
            </ThemeProvider>
        </ThemeProvider>,
    );
    expect(panel.classList.contains('dashkit-action-panel_theme_light-hc')).toBe(true);
    const lightStyles = getComputedStyle(panel);
    expect(lightStyles.getPropertyValue('--_--dashkit-action-panel-default-color')).toBe(
        '#000000b2',
    );
    expect(lightStyles.getPropertyValue('--_--dashkit-action-panel-default-item-hover-color')).toBe(
        '#ffffff12',
    );

    // CSS-only theme setups should keep their previous light defaults without a ThemeProvider.
    rerender(
        <div className="g-root_theme_light">
            <ActionPanel items={[]} />
        </div>,
    );
    const unthemedPanel = container.querySelector('.dashkit-action-panel') as HTMLElement;
    expect(unthemedPanel.classList.contains('dashkit-action-panel_theme_unset')).toBe(true);
    expect(
        getComputedStyle(unthemedPanel).getPropertyValue('--_--dashkit-action-panel-default-color'),
    ).toBe('#000000b2');
    stylesheet.remove();
});
