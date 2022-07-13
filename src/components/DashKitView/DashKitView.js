import React from 'react';
import block from 'bem-cn-lite';
import {DashKitContext} from '../../context/DashKitContext';
import GridLayout from '../GridLayout/GridLayout';
import MobileLayout from '../MobileLayout/MobileLayout';
import {withContext} from '../../hocs/withContext';
import {useCalcPropsLayout} from '../../hooks/useCalcLayout';

import './DashKitView.scss';

const b = block('dashkit');

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

const DashKitViewForwardedMeta = React.forwardRef((props, ref) => {
    const layout = useCalcPropsLayout(props.config, props.registerManager);
    return <DashKitViewWithContext {...props} layout={layout} forwardedMetaRef={ref} />;
});

DashKitViewForwardedMeta.displayName = 'DashKitViewForwardedMeta';

export default DashKitViewForwardedMeta;
