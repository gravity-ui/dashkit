import {GridStack} from 'gridstack';

// GridStack publishes its runtime version but omits the field from its declarations.
export const GRIDSTACK_VERSION = (GridStack as typeof GridStack & {GDRev: string}).GDRev;
export {GridStack, GridStackEngine, Utils} from 'gridstack';
export type {
    DDElementHost,
    GridStackNode,
    GridStackMoveOpts,
    GridStackPosition,
    GridStackOptions,
    GridItemHTMLElement,
} from 'gridstack';
