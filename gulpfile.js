const path = require('path');

const utils = require('@gravity-ui/gulp-utils');
const {task, src, dest, series, parallel, watch} = require('gulp');
const sass = require('gulp-dart-sass');
const sourcemaps = require('gulp-sourcemaps');
const rimraf = require('rimraf');

const BUILD_DIR = path.resolve('build');

const {version, sideEffects} = require('./package.json');

task('clean', (done) => {
    rimraf.sync(BUILD_DIR);
    done();
});

async function compileTs(modules = false) {
    const tsProject = await utils.createTypescriptProject({
        compilerOptions: {
            declaration: true,
            module: modules ? 'esnext' : 'nodenext',
            moduleResolution: modules ? 'bundler' : 'nodenext',
            ...(modules ? undefined : {verbatimModuleSyntax: false}),
        },
    });

    const transformers = [
        tsProject.customTransformers.transformScssImports,
        tsProject.customTransformers.transformLocalModules,
    ];

    const moduleType = modules ? 'esm' : 'cjs';

    return new Promise((resolve) => {
        src([
            'src/**/*.{js,jsx,ts,tsx}',
            '!src/**/__stories__/**/*.{js,jsx,ts,tsx}',
            '!src/**/__test__/**/*.*',
            '!src/**/__tests__/**/*.*',
        ])
            .pipe(sourcemaps.init())
            .pipe(
                tsProject({
                    customTransformers: {
                        before: transformers,
                        afterDeclarations: transformers,
                    },
                }),
            )
            .pipe(sourcemaps.write('.', {includeContent: true, sourceRoot: '../../src'}))
            .pipe(
                utils.addVirtualFile({
                    fileName: 'package.json',
                    text: JSON.stringify({
                        version,
                        type: modules ? 'module' : 'commonjs',
                        sideEffects,
                    }),
                }),
            )
            .pipe(dest(path.resolve(BUILD_DIR, moduleType)))
            .on('end', resolve);
    });
}

task('compile-to-esm', () => {
    return compileTs(true);
});

task('compile-to-cjs', () => {
    return compileTs();
});

// GridStack publishes extensionless ESM. Transpile its native modules for our CJS entry.
task('gridstack-cjs', (done) => {
    const fs = require('fs');
    const ts = require('typescript');
    const source = path.dirname(require.resolve('gridstack'));
    const target = path.join(BUILD_DIR, 'cjs', 'gridstack-runtime');
    fs.mkdirSync(target, {recursive: true});
    for (const name of fs.readdirSync(source)) {
        if (!name.endsWith('.js') || name.includes('-all')) {
            continue;
        }
        const result = ts.transpileModule(fs.readFileSync(path.join(source, name), 'utf8'), {
            compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
        });
        fs.writeFileSync(path.join(target, name), result.outputText);
    }
    fs.copyFileSync(path.join(source, '..', 'LICENSE'), path.join(target, 'LICENSE'));
    const entry = path.join(BUILD_DIR, 'cjs', 'components', 'GridStack', 'runtime.js');
    fs.writeFileSync(
        entry,
        fs
            .readFileSync(entry, 'utf8')
            .replace(
                /require\(["']gridstack["']\)/g,
                'require("../../gridstack-runtime/gridstack")',
            ),
    );
    done();
});

task('copy-js-declarations', () => {
    return src(['src/**/*.d.ts', '!src/**/__stories__/**/*.d.ts'])
        .pipe(dest(path.resolve(BUILD_DIR, 'esm')))
        .pipe(dest(path.resolve(BUILD_DIR, 'cjs')));
});

task('copy-i18n', () => {
    return src(['src/**/i18n/*.json'])
        .pipe(dest(path.resolve(BUILD_DIR, 'esm')))
        .pipe(dest(path.resolve(BUILD_DIR, 'cjs')));
});

task('styles-components', () => {
    return src(['src/**/*.scss', '!src/components/**/__stories__/**/*.scss'])
        .pipe(sass({includePaths: ['node_modules']}).on('error', sass.logError))
        .pipe(dest(path.resolve(BUILD_DIR, 'esm')))
        .pipe(dest(path.resolve(BUILD_DIR, 'cjs')));
});

// Bundles the AI-facing docs tree (cleaned README overview) into build/docs so it ships
// in the npm tarball.
task('copy-docs', (done) => {
    const {buildDocs} = require('@gravity-ui/readme-validator');
    buildDocs({
        rootDir: __dirname,
        outDir: path.join(__dirname, 'build', 'docs'),
        sources: [],
    });
    done();
});

task(
    'build',
    series([
        'clean',
        parallel(['compile-to-esm', 'compile-to-cjs']),
        parallel(['copy-js-declarations', 'copy-i18n']),
        'styles-components',
        'gridstack-cjs',
        'copy-docs',
    ]),
);

task('default', series(['build']));

task(
    'rebuild',
    series([
        parallel([
            'compile-to-esm',
            'compile-to-cjs',
            'copy-js-declarations',
            'copy-i18n',
            'styles-components',
        ]),
        'gridstack-cjs',
    ]),
);

task(
    'watch',
    series(['build'], () => {
        return watch(['src/**/*.{js,jsx,ts,tsx,scss}'], series(['rebuild']));
    }),
);
