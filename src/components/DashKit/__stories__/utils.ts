import {DashKitProps} from '../DashKit';
import {WidgetLayout} from '../../../typings';
import {ConfigItem} from '../../../shared';

export function makeid(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export const titleId = 'nk';

export const getConfig = (
    items?: ConfigItem[],
    layout?: Pick<WidgetLayout, 'i' | 'h' | 'w' | 'y' | 'x'>[],
): DashKitProps['config'] => ({
    salt: '0.46703554571365613',
    counter: 5,
    items: items || [
        {
            id: titleId,
            data: {
                size: 'm',
                text: 'Title widget',
                showInTOC: true,
            },
            type: 'title',
            namespace: 'default',
            orderId: 1,
        },
        {
            id: 'Ea',
            data: {
                text: 'special mode _editActive',
                _editActive: true,
            },
            type: 'text',
            namespace: 'default',
        },
        {
            id: 'zR',
            data: {
                text: 'Text widget',
            },
            type: 'text',
            namespace: 'default',
            orderId: 0,
        },
        {
            id: 'Dk',
            data: {
                foo: 'bar',
            },
            type: 'custom',
            namespace: 'default',
            orderId: 5,
        },
    ],
    layout: layout || [
        {
            h: 2,
            i: titleId,
            w: 36,
            x: 0,
            y: 0,
        },
        {
            h: 6,
            i: 'Ea',
            w: 12,
            x: 0,
            y: 2,
        },
        {
            h: 6,
            i: 'zR',
            w: 12,
            x: 12,
            y: 2,
        },
        {
            h: 10,
            i: 'Dk',
            w: 10,
            x: 0,
            y: 8,
        },
    ],
    aliases: {},
    connections: [],
});

export const gridItemsShowcase = [
    {
        id: '0',
        data: {
            size: 'm',
            text: 'Item 0',
            showInTOC: true,
        },
        type: 'title',
        namespace: 'default',
        orderId: 1,
    },
    {
        id: '1',
        data: {
            size: 'm',
            text: 'Item 1',
            showInTOC: true,
        },
        type: 'title',
        namespace: 'default',
        orderId: 1,
    },
    {
        id: '2',
        data: {
            size: 'm',
            text: 'Item 2',
        },
        type: 'title',
        namespace: 'default',
    },
    {
        id: '3',
        data: {
            size: 'm',
            text: 'Item 3',
        },
        type: 'title',
        namespace: 'default',
        orderId: 0,
    },
    {
        id: '4',
        data: {
            foo: 'bar',
            size: 'm',
            text: 'Item 4',
        },
        type: 'title',
        namespace: 'default',
        orderId: 5,
    },
    {
        id: '5',
        data: {
            size: 'm',
            text: 'Item 5',
            showInTOC: true,
        },
        type: 'title',
        namespace: 'default',
        orderId: 1,
    },
    {
        id: '6',
        data: {
            size: 'm',
            text: 'Item 6',
        },
        type: 'title',
        namespace: 'default',
    },
    {
        id: '7',
        data: {
            size: 'm',
            text: 'Item 7',
        },
        type: 'title',
        namespace: 'default',
        orderId: 0,
    },
    {
        id: '8',
        data: {
            foo: 'bar',
            size: 'm',
            text: 'Item 8',
        },
        type: 'title',
        namespace: 'default',
        orderId: 5,
    },
    {
        id: '9',
        data: {
            size: 'm',
            text: 'Item 9',
        },
        type: 'title',
        namespace: 'default',
        orderId: 0,
    },
    {
        id: '10',
        data: {
            foo: 'bar',
            size: 'm',
            text: 'Item 10',
        },
        type: 'title',
        namespace: 'default',
        orderId: 5,
    },
];

export const gridLayoutShowcase = [
    {
        x: 5,
        y: 0,
        w: 6,
        h: 6,
        i: '0',
    },
    {
        x: 0,
        y: 0,
        w: 5,
        h: 4,
        i: '1',
    },
    {
        x: 11,
        y: 3,
        w: 5,
        h: 6,
        i: '2',
    },
    {
        x: 11,
        y: 0,
        w: 12,
        h: 3,
        i: '3',
    },
    {
        x: 16,
        y: 3,
        w: 7,
        h: 11,
        i: '4',
    },
    {
        x: 23,
        y: 0,
        w: 13,
        h: 7,
        i: '5',
    },
    {
        x: 0,
        y: 4,
        w: 5,
        h: 2,
        i: '6',
    },
    {
        x: 0,
        y: 6,
        w: 11,
        h: 4,
        i: '7',
    },
    {
        x: 23,
        y: 7,
        w: 9,
        h: 3,
        i: '8',
    },
    {
        x: 11,
        y: 9,
        w: 5,
        h: 8,
        i: '9',
    },
    {
        x: 24,
        y: 10,
        w: 12,
        h: 5,
        i: '10',
    },
];
