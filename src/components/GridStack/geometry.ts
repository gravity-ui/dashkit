import type {ConfigLayout} from '../../shared';
import type {ReactGridLayoutProps} from '../../typings';

export function getGridGeometry(width: number, props: ReactGridLayoutProps) {
    const [gapX, gapY] = props.margin || [10, 10];
    const [paddingX, paddingY] = props.containerPadding || props.margin || [10, 10];
    const cols = props.cols ?? 12;
    const rowHeight = props.rowHeight ?? 150;
    const stepX = (width - 2 * paddingX + gapX) / cols;
    const stepY = rowHeight + gapY;
    return {gapX, gapY, paddingX, paddingY, cols, rowHeight, stepX, stepY};
}

export function visibleGeometry(
    layout: Pick<ConfigLayout, 'x' | 'y' | 'w' | 'h'>,
    geometry: ReturnType<typeof getGridGeometry>,
) {
    return {
        left: layout.x * geometry.stepX,
        top: layout.y * geometry.stepY,
        width: Math.max(0, layout.w * geometry.stepX - geometry.gapX),
        height: Math.max(0, layout.h * geometry.stepY - geometry.gapY),
    };
}
