/** @jest-environment jsdom */

import React from 'react';

import {Provider, configure} from '@gravity-ui/uikit';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';

import {DRAGGABLE_CANCEL_CLASS_NAME} from '../../../constants';
import {DashkitOverlayControlsContext} from '../../../context';
import type {OverlayControlsCtxShape} from '../../../context';
import type {ConfigItem} from '../../../shared';
import OverlayControls from '../OverlayControls';

const configItem: ConfigItem = {id: 'item1', type: 'text', namespace: 'default', data: {}};

const createContext = (
    overrides: Partial<OverlayControlsCtxShape> = {},
): OverlayControlsCtxShape => ({
    menu: [],
    itemsParams: {item1: {scale: 'd'}},
    itemsState: {item1: {tabId: 'tab1'}},
    editItem: jest.fn(),
    removeItem: jest.fn(),
    getLayoutItem: () => ({i: 'item1', x: 0, y: 0, w: 2, h: 2}),
    ...overrides,
});

const renderControls = (
    context: OverlayControlsCtxShape,
    onItemClick?: () => void,
    lang?: string,
) =>
    render(
        <Provider theme="light" lang={lang}>
            <DashkitOverlayControlsContext.Provider value={context}>
                <OverlayControls configItem={configItem} onItemClick={onItemClick} />
            </DashkitOverlayControlsContext.Provider>
        </Provider>,
    );

const getTrigger = () => screen.getByRole('button', {name: 'Additional options'});

const openMenu = async () => {
    await act(async () => {
        fireEvent.click(getTrigger());
    });
};

// The popup leaves the DOM after its closing transition
const expectMenuClosed = () =>
    waitFor(() => expect(screen.queryAllByRole('menuitem')).toHaveLength(0));

const getMenuItemTexts = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

describe('OverlayControls menu', () => {
    it('labels the trigger and keeps its qa attribute', () => {
        renderControls(createContext());

        expect(getTrigger().getAttribute('data-qa')).toBe('dashkit-overlay-control-menu');
        expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    });

    it('shows copy and delete by default', async () => {
        renderControls(createContext());
        await openMenu();

        expect(getMenuItemTexts()).toEqual(['Copy', 'Delete']);
    });

    it('takes the texts in the language of the uikit Provider', async () => {
        renderControls(createContext(), undefined, 'ru');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Дополнительные опции'}));
        });

        expect(getMenuItemTexts()).toEqual(['Копировать', 'Удалить']);
    });

    it('follows configure when the Provider sets no language', async () => {
        configure({lang: 'ru'});

        try {
            renderControls(createContext());

            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: 'Дополнительные опции'}));
            });

            expect(getMenuItemTexts()).toEqual(['Копировать', 'Удалить']);
        } finally {
            configure({lang: 'en'});
        }
    });

    it('cancels dragging inside the menu popup', async () => {
        renderControls(createContext());
        await openMenu();

        expect(
            screen.getAllByRole('menuitem')[0].closest(`.${DRAGGABLE_CANCEL_CLASS_NAME}`),
        ).not.toBeNull();
    });

    it('removes the item and closes the menu on a default item click', async () => {
        const context = createContext();
        const onItemClick = jest.fn();
        renderControls(context, onItemClick);
        await openMenu();

        await act(async () => {
            fireEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
        });

        expect(context.removeItem).toHaveBeenCalledWith('item1');
        expect(onItemClick).toHaveBeenCalledTimes(1);
        await expectMenuClosed();
    });

    it('renders custom items with their title, class, qa and icon', async () => {
        renderControls(
            createContext({
                menu: [
                    {
                        id: 'inspect',
                        title: 'Inspect',
                        icon: <svg data-qa="inspect-icon" />,
                        className: 'custom-item',
                        qa: 'inspect-item',
                    },
                    {id: 'emoji', title: 'Emoji', icon: '★'},
                    {id: 'hidden', title: 'Hidden', visible: () => false},
                ],
            }),
        );
        await openMenu();

        expect(getMenuItemTexts()).toEqual(['Inspect', '★Emoji']);

        const inspect = screen.getByRole('menuitem', {name: 'Inspect'});
        expect(inspect.classList.contains('custom-item')).toBe(true);
        expect(inspect.getAttribute('data-qa')).toBe('inspect-item');
        expect(inspect.querySelector('[data-qa="inspect-icon"]')).not.toBeNull();
    });

    it('renders no icon slot for an empty icon', async () => {
        renderControls(createContext({menu: [{id: 'inspect', title: 'Inspect', icon: ''}]}));
        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Inspect'}).children).toHaveLength(0);
    });

    it('gives a default item of a custom menu its default action', async () => {
        const context = createContext({menu: [{id: 'settings', title: 'Edit'}]});
        renderControls(context);
        await openMenu();

        await act(async () => {
            fireEvent.click(screen.getByRole('menuitem', {name: 'Edit'}));
        });

        expect(context.editItem).toHaveBeenCalledWith(configItem);
    });

    it('calls the custom handler with the item, its params and state', async () => {
        const handler = jest.fn();
        const onItemClick = jest.fn();
        renderControls(
            createContext({menu: [{id: 'inspect', title: 'Inspect', handler}]}),
            onItemClick,
        );
        await openMenu();

        await act(async () => {
            fireEvent.click(screen.getByRole('menuitem', {name: 'Inspect'}));
        });

        expect(handler).toHaveBeenCalledWith(configItem, {scale: 'd'}, {tabId: 'tab1'});
        expect(onItemClick).toHaveBeenCalledTimes(1);
        await expectMenuClosed();
    });

    it('does not loop on updates when custom items have handlers', async () => {
        const visible = jest.fn(() => true);
        renderControls(
            createContext({menu: [{id: 'inspect', title: 'Inspect', handler: jest.fn(), visible}]}),
        );
        await openMenu();

        // Each render and each componentDidMount/componentDidUpdate builds the items once;
        // an update loop would call this without bound.
        expect(visible.mock.calls.length).toBeLessThan(20);
    });
});
