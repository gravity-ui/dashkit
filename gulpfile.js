const path = require('path');

const utils = require('@gravity-ui/gulp-utils');
const {task, src, dest, series, parallel} = require('gulp');
const sass = require('gulp-dart-sass');
const sourcemaps = require('gulp-sourcemaps');
const rimraf = require('rimraf');

const BUILD_DIR = path.resolve('build');

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
            '!src/**/__test__/**/*.*])',
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
                    text: JSON.stringify({type: modules ? 'module' : 'commonjs'}),
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
        .pipe(sass().on('error', sass.logError))
        .pipe(dest(path.resolve(BUILD_DIR, 'esm')))
        .pipe(dest(path.resolve(BUILD_DIR, 'cjs')));
});

task(
    'build',
    series([
        'clean',
        parallel(['compile-to-esm', 'compile-to-cjs']),
        parallel(['copy-js-declarations', 'copy-i18n']),
        'styles-components',
    ]),
);

task('default', series(['build']));
