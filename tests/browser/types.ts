import type {DashKitEngine} from '../../src/components/GridStack/engine';
import type {GridStack, GridStackNode} from '../../src/components/GridStack/runtime';

export type NativeElement = HTMLElement & {
    gridstackNode: GridStackNode & {
        x: number;
        y: number;
        w: number;
        h: number;
        grid: GridStack & {engine: DashKitEngine};
    };
    gridstack?: GridStack;
    ddElement?: {ddDraggable?: object};
};
