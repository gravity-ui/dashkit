import React from 'react';

import {DashKitContext} from '../../context';
import {withContext} from '../../hocs/withContext';
import type {DashKitWithContextProps} from '../../hocs/withContext';
import {useCalcPropsLayout} from '../../hooks/useCalcLayout';
import {cn} from '../../utils/cn';
import GridLayout from '../GridLayout/GridLayout';
import MobileLayout from '../MobileLayout/MobileLayout';

import './DashKitView.scss';

const b = cn('dashkit');

type DashKitViewProps = Omit<DashKitWithContextProps, 'layout' | 'forwardedMetaRef'>;

function DashKitView() {
    const context = React.useContext(DashKitContext);
    const {registerManager, forwardedMetaRef} = context;

    return (
        <div className={b({theme: registerManager.settings.theme})}>
            {registerManager.settings.isMobile ? (
                <MobileLayout />
            ) : (
                <GridLayout ref={forwardedMetaRef} />
            )}
        </div>
    );
}

const DashKitViewWithContext = withContext(DashKitView);

const DashKitViewForwardedMeta = React.forwardRef((props: DashKitViewProps, ref) => {
    const layout = useCalcPropsLayout(props.config, props.registerManager);

    return <DashKitViewWithContext {...props} layout={layout} forwardedMetaRef={ref} />;
});

DashKitViewForwardedMeta.displayName = 'DashKitViewForwardedMeta';

export default DashKitViewForwardedMeta;
