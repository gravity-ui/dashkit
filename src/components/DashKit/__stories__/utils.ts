import {DashKitProps} from '../DashKit';

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

export const getConfig = (): DashKitProps['config'] => ({
    salt: '0.46703554571365613',
    counter: 5,
    items: [
        {
            id: titleId,
            data: {
                size: 'm',
                text: 'Заголовок',
                showInTOC: true,
            },
            type: 'title',
            namespace: 'default',
            orderId: 1,
        },
        {
            id: 'Ea',
            data: {
                text: 'режим _editActive',
                _editActive: true,
            },
            type: 'text',
            namespace: 'default',
        },
        {
            id: 'zR',
            data: {
                text: '### Текст',
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
    layout: [
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
            h: 4,
            i: 'Dk',
            w: 8,
            x: 0,
            y: 8,
        },
    ],
    aliases: {},
    connections: [],
});
