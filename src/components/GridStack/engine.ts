import type {CompactType} from '../../typings';

import {requireValue} from './invariants';
import {GridStackEngine, Utils} from './runtime';
import type {GridStackMoveOpts, GridStackNode} from './runtime';

export type EngineMode = {
    compactType?: CompactType;
    allowOverlap?: boolean;
    preventCollision?: boolean;
};

/** A per-grid engine: the stock maxRow simulators instantiate the stock class. */
type EngineNode = GridStackNode & {
    x: number;
    y: number;
    w: number;
    h: number;
    _dirty?: boolean;
    _orig?: {x: number; y: number; w: number; h: number};
    _id?: number;
    _willFitPos?: GridStackMoveOpts;
};
type Internals = {
    _packNodes(): GridStackEngine;
    _fixCollisions(
        node: GridStackNode,
        next?: GridStackNode,
        collide?: GridStackNode,
        options?: GridStackMoveOpts,
    ): boolean;
    _notify(): GridStackEngine;
};
// GridStack strips its @internal methods from declarations, but supports engine subclasses.
const EngineBase = GridStackEngine as unknown as new (
    options?: ConstructorParameters<typeof GridStackEngine>[0],
) => GridStackEngine & Internals;

export class DashKitEngine extends EngineBase {
    declare nodes: EngineNode[];
    mode: EngineMode = {};
    restoring = false;
    dropSize?: GridStackNode & {id: string; w: number; h: number};

    nodeBoundFix(nodeInput: GridStackNode, resizing?: boolean) {
        const node = nodeInput;
        if (this.restoring) {
            return this;
        }
        if (this.dropSize && node.id === this.dropSize.id) {
            Object.assign(node, this.dropSize);
            this.dropSize = undefined;
        }
        if (resizing) {
            super.nodeBoundFix(node, resizing);
        } else {
            const {minW, minH, maxW, maxH, x, y, w, h} = node;
            const {_dirty, _orig} = node as EngineNode;
            delete node.minW;
            delete node.minH;
            delete node.maxW;
            delete node.maxH;
            try {
                super.nodeBoundFix(node, resizing);
                const fractionalW = w !== undefined && w > 0 && w < 1;
                const fractionalH = h !== undefined && h > 0 && h < 1;
                // Stock bounds impose a one-unit minimum even on saved geometry and moves.
                if (fractionalW) {
                    node.w = Math.min(w, this.column);
                    node.x = Math.max(0, Math.min(x ?? 0, this.column - node.w));
                }
                if (fractionalH) {
                    node.h = Math.min(h, this.maxRow || Infinity);
                    node.y = Math.max(0, Math.min(y ?? 0, (this.maxRow || Infinity) - node.h));
                }
                if (fractionalW || fractionalH) {
                    (node as EngineNode)._dirty =
                        _dirty ||
                        (_orig
                            ? !Utils.samePos(node, _orig)
                            : node.x !== x || node.y !== y || node.w !== w || node.h !== h);
                }
            } finally {
                Object.assign(node, {minW, minH, maxW, maxH});
            }
        }
        return this;
    }

    collide(...args: Parameters<GridStackEngine['collide']>) {
        return this.restoring || this.mode.allowOverlap ? undefined : super.collide(...args);
    }

    collideAll(...args: Parameters<GridStackEngine['collideAll']>) {
        return this.restoring || this.mode.allowOverlap ? [] : super.collideAll(...args);
    }

    _packNodes() {
        if (
            this.restoring ||
            this.batchMode ||
            this.mode.allowOverlap ||
            this.mode.compactType === null
        ) {
            return this;
        }
        const horizontal =
            this.mode.compactType === 'horizontal' || this.mode.compactType === 'horizontal-nowrap';
        const axis = horizontal ? 'x' : 'y';
        const ordered = [...this.nodes].sort((a, b) => {
            // Legacy horizontal ties use the host's sort semantics, which differ across browsers.
            if (horizontal) {
                return a.x > b.x || (a.x === b.x && a.y > b.y) ? 1 : -1;
            }
            return a.y - b.y || a.x - b.x;
        });
        const placed: EngineNode[] = ordered.filter((node) => node.locked);
        const advance = (nodeInput: EngineNode, target: number) => {
            const node = nodeInput;
            node[axis] += 1;
            node._dirty = true;
            const index = ordered.indexOf(node);
            for (let i = index + 1; i < ordered.length; i++) {
                const other = ordered[i];
                if (other.locked) {
                    continue;
                }
                if (other.y > node.y + node.h) {
                    break;
                }
                if (Utils.isIntercepted(node, other)) {
                    advance(other, target + (horizontal ? node.w : node.h));
                }
            }
            node[axis] = target;
        };
        ordered.forEach((nodeInput) => {
            const node = nodeInput;
            if (node.locked) {
                return;
            }
            const before = {x: node.x, y: node.y};
            if (!horizontal) {
                node.y = Math.min(
                    node.y,
                    placed.reduce((bottom, other) => Math.max(bottom, other.y + other.h), 0),
                );
            }
            while (node[axis] > 0 && !placed.some((other) => Utils.isIntercepted(node, other))) {
                node[axis] = Math.max(0, node[axis] - 1);
            }
            let collision: EngineNode | undefined;
            while ((collision = placed.find((other) => Utils.isIntercepted(node, other)))) {
                advance(node, collision[axis] + (horizontal ? collision.w : collision.h));
                if (horizontal && node.x + node.w > this.column) {
                    node.x = this.column - node.w;
                    node.y += 1;
                    while (
                        node.x > 0 &&
                        !placed.some((other) => Utils.isIntercepted(node, other))
                    ) {
                        node.x = Math.max(0, node.x - 1);
                    }
                }
            }
            node._dirty = node._dirty || before.x !== node.x || before.y !== node.y;
            placed.push(node);
        });
        return this;
    }

    _fixCollisions(
        node: EngineNode,
        next = node,
        collide?: GridStackNode,
        options: GridStackMoveOpts = {},
    ) {
        if (this.restoring || this.batchMode || this.mode.allowOverlap) {
            return false;
        }
        if (
            this.mode.compactType !== 'horizontal' &&
            this.mode.compactType !== 'horizontal-nowrap'
        ) {
            return super._fixCollisions(node, next, collide, options);
        }
        const collisions = this.collideAll(node, next, options.skip);
        for (const other of collisions) {
            const x = next.x + next.w;
            const wraps = x + requireValue(other.w, 'other.w') > this.column;
            this.moveNode(other, {
                x: wraps ? 0 : x,
                y: wraps ? next.y + next.h : other.y,
                skip: node,
                nested: true,
                pack: false,
            });
        }
        return false;
    }

    moveNodeCheck(node: EngineNode, optionsInput: GridStackMoveOpts) {
        const options = optionsInput;
        if (this.mode.compactType === 'horizontal-nowrap') {
            const maxW =
                this.column -
                this.nodes.reduce((sum, other) => sum + (other === node ? 0 : other.w), 0);
            options.w = Math.min(options.w ?? node.w, maxW);
            options.y = 0;
            const minW = node.minW || 1;
            if (options.w < (options.resizing ? minW : Math.min(node.w, minW))) {
                return false;
            }
        }
        const next = {...node, ...options};
        this.nodeBoundFix(next, Boolean(options.resizing));
        if (this.mode.preventCollision && !this.mode.allowOverlap && this.collide(node, next)) {
            return false;
        }
        if (node.w === next.w && node.h === next.h && node.x === next.x && node.y === next.y) {
            return false;
        }
        const before = this.nodes.map((entry) => ({...entry}));
        const moved = this.moveNode(node, {...options, pack: true});
        if (this.maxRow && this.getRow() > this.maxRow) {
            before.forEach((entry) =>
                Object.assign(
                    requireValue(
                        this.nodes.find((candidate) => candidate._id === entry._id),
                        'rollback node',
                    ),
                    entry,
                ),
            );
            this._notify();
            return false;
        }
        return moved;
    }

    willItFit(nodeInput: GridStackNode & {w: number; h: number}) {
        const node = nodeInput;
        const input =
            this.dropSize && (!node.id || node.id === this.dropSize.id)
                ? {...node, ...this.dropSize}
                : node;
        if (
            input.w > this.column ||
            (this.maxRow && input.h > this.maxRow) ||
            (this.mode.compactType === 'horizontal-nowrap' &&
                input.w +
                    this.nodes.reduce(
                        (sum, entry) => sum + (input.id && entry.id === input.id ? 0 : entry.w),
                        0,
                    ) >
                    this.column)
        ) {
            return false;
        }
        const clone = new DashKitEngine({column: this.column, maxRow: this.maxRow, float: true});
        clone.mode = this.mode;
        clone.nodes = this.nodes
            .filter((entry) => !input.id || entry.id !== input.id)
            .map((entry) => ({...entry, el: undefined, grid: undefined}));
        const candidate = {...input, _id: undefined, el: undefined, grid: undefined};
        if (this.mode.allowOverlap && candidate.x === undefined) {
            candidate.x = candidate.y = 0;
        }
        clone.addNode(candidate);
        const fits = !this.maxRow || clone.getRow() <= this.maxRow;
        if (fits) {
            (node as EngineNode)._willFitPos = Utils.copyPos({}, candidate);
        }
        return fits;
    }
}
