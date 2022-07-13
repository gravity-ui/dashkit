const path = require('path');

module.exports = {
    process: function (src, filename) {
        const assetFilename = JSON.stringify(path.basename(filename));

        if (filename.match(/\.svg$/)) {
            return `module.exports = {
              __esModule: true,
              default: {
                id: ${assetFilename},
                url: ${assetFilename},
                viewBox: '0 0 0 0'
              },
              ReactComponent: (props) => ({
                $$typeof: Symbol.for('react.element'),
                type: 'svg',
                ref: null,
                key: null,
                props: Object.assign({}, props, {
                  children: ${assetFilename}
                })
              }),
            };`;
        }

        return `module.exports = ${assetFilename};`;
    },
};
