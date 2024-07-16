import React from 'react';

import {DashKitContext} from '../../context/DashKitContext';
import {withContext} from '../../hocs/withContext';
import {useCalcPropsLayout} from '../../hooks/useCalcLayout';
import type {RegisterManager} from '../../utils';
import {cn} from '../../utils/cn';
import type {DashKitProps} from '../DashKit';
import GridLayout from '../GridLayout/GridLayout';
import MobileLayout from '../MobileLayout/MobileLayout';

import './DashKitView.scss';

const b = cn('dashkit');

type DashKitViewProps = DashKitProps & {
    registerManager: RegisterManager;
};

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
