const ts = require('typescript');

// Dependencies of uikit that ship only ES modules, while Jest runs CommonJS. ts-jest does not
// emit for JavaScript files of node_modules, so they are transpiled here.
module.exports = {
    process(source, fileName) {
        const {outputText} = ts.transpileModule(source, {
            fileName,
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        });
        return {code: outputText};
    },
};
