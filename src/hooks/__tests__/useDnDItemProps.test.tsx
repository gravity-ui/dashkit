/** @jest-environment jsdom */

import React from 'react';

import {act, fireEvent, render, screen} from '@testing-library/react';

import {ActionPanel} from '../../components/ActionPanel/ActionPanel';
import {DashKitDnDWrapper} from '../../components/DashKitDnDWrapper/DashKitDnDWrapper';

const item = {id: 'chart', title: 'Chart', icon: 'icon', dragProps: {type: 'chart'}};

describe('ActionPanel drag preview', () => {
    it('captures the solid item before disabling the panel source and restores it on drag end', () => {
        jest.useFakeTimers();
        const onDragStart = jest.fn();
        const onDragEnd = jest.fn();
        const setDragImage = jest.fn();

        render(
            <DashKitDnDWrapper onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <ActionPanel items={[item]} />
            </DashKitDnDWrapper>,
        );
        const source = screen.getByRole('button', {name: /Chart/});
        const disabledSourceClassName = 'dashkit-action-panel__item_dragging-source-disabled';

        setDragImage.mockImplementation(() => {
            expect(source.classList.contains('dashkit-action-panel__item_dragging')).toBe(true);
            expect(source.classList.contains(disabledSourceClassName)).toBe(false);
        });
        fireEvent.dragStart(source, {dataTransfer: {setDragImage}});
        expect(setDragImage).toHaveBeenCalledWith(source, 0, 0);
        expect(onDragStart).toHaveBeenCalledWith(item.dragProps);
        act(() => jest.runOnlyPendingTimers());
        expect(source.classList.contains(disabledSourceClassName)).toBe(true);

        fireEvent.dragEnd(source);
        expect(source.classList.contains('dashkit-action-panel__item_dragging')).toBe(false);
        expect(source.classList.contains(disabledSourceClassName)).toBe(false);
        expect(onDragEnd).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    it('respects a custom drag image', () => {
        const setDragImage = jest.fn();
        render(
            <DashKitDnDWrapper dragImageSrc="data:image/png;base64,AAAA">
                <ActionPanel items={[item]} />
            </DashKitDnDWrapper>,
        );

        fireEvent.dragStart(screen.getByRole('button', {name: /Chart/}), {
            dataTransfer: {setDragImage},
        });
        expect(setDragImage.mock.calls[0][0]).toBeInstanceOf(HTMLImageElement);
    });
});
