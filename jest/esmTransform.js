const ts = require('typescript');

// Dependencies of uikit that ship only ES modules: Jest runs CommonJS
module.exports = {
    process(source, fileName) {
        const {outputText} = ts.transpileModule(source, {
            fileName,
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                allowJs: true,
            },
        });
        return {code: outputText};
    },
};
