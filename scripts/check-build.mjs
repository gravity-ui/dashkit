#!/usr/bin/env node
// Checks the built package (run `npm run build` first). Adapted from gravity-ui/chartkit#957.
//
// Load: `require` of build/cjs and `import` of build/esm for every entry point of the `exports`
// map, through the package's own name. Node resolves dashkit's files strictly, so a missing
// extension, a directory import or a CommonJS file with ESM syntax fails here. CSS and JSON are
// handled the way bundlers handle them: Node cannot load CSS, and imports JSON only with an import
// attribute (build/esm/i18n and uikit import it without one). `module.registerHooks` hooks run for
// both `import` and `require`, so `require.extensions` is not needed.
// Dependencies are resolved the way bundlers resolve them: an `import` of a package without an
// `exports` map follows its `module` field, and a specifier may omit `.js` or name a directory
// (the uikit 7 ESM build and its dependencies rely on all three). dashkit's own imports get none
// of this, except the packages in OWN_IMPORTS_THROUGH_MODULE_FIELD. Every run prints what needed
// these rules.
// ES modules that the CommonJS build reaches through `require` are printed too: CommonJS
// consumers need require(esm) for them (Node 20.19+ / 22.12+). One of dashkit's own files among
// them is an error. The list is best effort; `node --no-experimental-require-module
// scripts/check-build.mjs` gives the exact answer.
// `./helpers` must load without a DOM. `.` creates a window focus observer at module level, so it
// loads under jsdom globals, after the DOM-free entries. Both builds must export the same names.
//
// Scan: every emitted `.js` for ESM syntax (CommonJS build), extensionless relative specifiers
// (ESM build) and relative imports of missing files; every `.js` and `.d.ts` for bare specifiers
// that are neither dependencies nor peer dependencies.
//
// Misses: render-time failures, styles, bundler-specific behaviour beyond the rules above, and
// type packages that live only in devDependencies (`@types/react-grid-layout`:
// `react-grid-layout` itself is a dependency).
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import * as nodeModule from 'node:module';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {exit, stderr, stdout} from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {compileFunction} from 'node:vm';

const {builtinModules, createRequire, registerHooks} = nodeModule;

if (!registerHooks) {
    stderr.write('check-build needs Node.js 22.15 or later (module.registerHooks).\n');
    exit(1);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILD = join(ROOT, 'build');
const BUILD_URL = `${pathToFileURL(BUILD).href}/`;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const DECLARED = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
]);

// Entry points whose modules touch `window` or `document` at load time.
const DOM_ENTRIES = new Set(['.']);

// Packages the `.d.ts` files may name without declaring them: types that consumers get through
// the `@gravity-ui/uikit` peer. Add one only with the reason it is safe.
const TYPES_THROUGH_UIKIT = new Map();

// dashkit's own imports that may follow the `module` field, as bundlers do. Without a bundler
// they fail for the reason given; the run says when an entry is no longer needed.
const OWN_IMPORTS_THROUGH_MODULE_FIELD = new Map([
    [
        '@gravity-ui/icons',
        'no `exports` map before 2.20.0, and its CommonJS main hides the named exports from Node',
    ],
]);

for (const format of ['cjs', 'esm']) {
    if (!existsSync(join(BUILD, format))) {
        stderr.write(`build/${format} is missing: run \`npm run build\` first.\n`);
        exit(1);
    }
}

const require = createRequire(import.meta.url);
// Loaded before the hooks are registered, so that jsdom's own modules do not go through them.
// jsdom comes with jest-environment-jsdom, a devDependency.
const {JSDOM} = createRequire(require.resolve('jest-environment-jsdom'))('jsdom');

let failed = false;

function fail(message) {
    stderr.write(`${message}\n`);
    failed = true;
}

// `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`.
function packageName(specifier) {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isBuiltin(specifier) {
    return specifier.startsWith('node:') || builtinModules.includes(packageName(specifier));
}

function isOwnFile(url) {
    return url !== undefined && url.startsWith(BUILD_URL);
}

// The package a dependency file belongs to, for the report.
function packageOfUrl(url) {
    const marker = '/node_modules/';
    const index = url.lastIndexOf(marker);
    return index === -1 ? fileURLToPath(url) : packageName(url.slice(index + marker.length));
}

function isFile(path) {
    return existsSync(path) && statSync(path).isFile();
}

// A path the way bundlers resolve it: the file, the file with `.js`, or a directory through its
// own `package.json` (`module` before `main`) or its `index.js`.
function resolvePath(path) {
    if (isFile(path)) {
        return path;
    }
    if (isFile(`${path}.js`)) {
        return `${path}.js`;
    }
    const manifest = join(path, 'package.json');
    if (isFile(manifest)) {
        const {module, main} = JSON.parse(readFileSync(manifest, 'utf8'));
        for (const field of [module, main]) {
            const target = field && resolve(path, field);
            const resolved = target && target !== path && resolvePath(target);
            if (resolved) {
                return resolved;
            }
        }
    }
    return isFile(join(path, 'index.js')) ? join(path, 'index.js') : undefined;
}

// The directory and manifest of an installed package without an `exports` map, as seen from
// `parentURL`; packages with `exports` are left to Node.
function packageWithoutExports(name, parentURL) {
    try {
        const manifestPath = createRequire(parentURL).resolve(`${name}/package.json`);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        return manifest.exports ? undefined : {directory: dirname(manifestPath), manifest};
    } catch {
        return undefined;
    }
}

const RESOLUTION_ERRORS = ['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'];
// Imported through the `module` field, by dashkit (allow-listed) and by the dependencies.
const ownThroughModuleField = new Set();
const dependenciesThroughModuleField = new Set();
// Dependencies whose files import without `.js` or import a directory.
const dependenciesWithBundlerPaths = new Set();
const esmUnderRequire = new Set();

function resolved(path) {
    return {url: pathToFileURL(path).href, shortCircuit: true};
}

function resolveLikeBundlers(specifier, context, nextResolve) {
    const {parentURL} = context;
    const fromDependency = parentURL !== undefined && !isOwnFile(parentURL);
    const isBare =
        !specifier.startsWith('.') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('#') &&
        !specifier.includes(':') &&
        !isBuiltin(specifier);
    if (isBare && parentURL && context.conditions?.includes('import')) {
        const name = packageName(specifier);
        const isRoot = specifier === name;
        const allowed = fromDependency || (isRoot && OWN_IMPORTS_THROUGH_MODULE_FIELD.has(name));
        const found = allowed ? packageWithoutExports(name, parentURL) : undefined;
        const path =
            found && (!isRoot || found.manifest.module)
                ? resolvePath(join(found.directory, specifier.slice(name.length)))
                : undefined;
        if (path) {
            if (!isRoot) {
                dependenciesWithBundlerPaths.add(packageOfUrl(parentURL));
            } else if (fromDependency) {
                dependenciesThroughModuleField.add(name);
            } else {
                ownThroughModuleField.add(name);
            }
            return resolved(path);
        }
    }
    try {
        return nextResolve(specifier, context);
    } catch (error) {
        if (!fromDependency || isBare || !RESOLUTION_ERRORS.includes(error.code)) {
            throw error;
        }
        const path = resolvePath(resolve(dirname(fileURLToPath(parentURL)), specifier));
        if (!path) {
            throw error;
        }
        dependenciesWithBundlerPaths.add(packageOfUrl(parentURL));
        return resolved(path);
    }
}

// The loader passes a `.js` file of a package without `type` on without a format and detects
// ESM syntax only after the hooks. The same test as Node's: it does not compile as CommonJS
// because of ESM syntax.
const ESM_SYNTAX_ERRORS = [
    'Cannot use import statement outside a module',
    "Unexpected token 'export'",
    "Cannot use 'import.meta' outside a module",
];

function isEsm(url, result) {
    if (result.format === 'module') {
        return true;
    }
    if (result.format !== undefined || !url.endsWith('.js')) {
        return false;
    }
    try {
        compileFunction(String(result.source ?? ''), [
            'exports',
            'require',
            'module',
            '__filename',
            '__dirname',
        ]);
        return false;
    } catch (error) {
        return ESM_SYNTAX_ERRORS.some((message) => error.message.includes(message));
    }
}

registerHooks({
    resolve: resolveLikeBundlers,
    load(url, context, nextLoad) {
        if (url.endsWith('.css') || url.endsWith('.scss')) {
            const format = context.format === 'module' ? 'module' : 'commonjs';
            return {format, source: '', shortCircuit: true};
        }
        if (url.endsWith('.json') && !context.importAttributes?.type) {
            const source = readFileSync(new URL(url), 'utf8');
            return {format: 'json', source, shortCircuit: true};
        }
        const result = nextLoad(url, context);
        if (context.conditions?.includes('require') && isEsm(url, result)) {
            if (isOwnFile(url)) {
                fail(`build/cjs requires an ES module: ${relative(ROOT, fileURLToPath(url))}`);
            } else {
                esmUnderRequire.add(packageOfUrl(url));
            }
        }
        return result;
    },
});

function installDom() {
    const {window} = new JSDOM('<!doctype html><html><body></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost/',
    });
    // Only what Node lacks (`window`, `document`, `self`, `HTMLElement`, `requestAnimationFrame`…):
    // Node's own `Event`, `URL`, timers and the rest stay.
    for (const key of Object.getOwnPropertyNames(window)) {
        if (!(key in globalThis)) {
            Object.defineProperty(globalThis, key, {configurable: true, get: () => window[key]});
        }
    }
    return window;
}

// The names, with `default` only when the module has a default export: the CommonJS build has
// the key only when TypeScript emitted one, like the ESM build.
function exportNames(module) {
    return Object.keys(module)
        .filter((key) => key !== '__esModule')
        .sort();
}

async function load(label, loadModule) {
    try {
        const names = exportNames(await loadModule());
        stdout.write(`${label}: ${names.length} exports\n`);
        return names;
    } catch (error) {
        fail(`${label} failed to load: ${error.code ?? ''} ${error.message}`);
        return undefined;
    }
}

function* targets(value) {
    if (typeof value === 'string') {
        yield value;
    } else if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) {
            yield* targets(nested);
        }
    }
}

const packageTargets = [
    ...targets(pkg.exports),
    ...targets(pkg.typesVersions),
    pkg.main,
    pkg.module,
    pkg.types,
];
for (const target of new Set(packageTargets)) {
    if (target && !target.includes('*') && !existsSync(join(ROOT, target))) {
        fail(`package.json points to a missing file: ${target}`);
    }
}

const entries = Object.keys(pkg.exports).filter((entry) => entry !== './package.json');
const passes = [
    entries.filter((entry) => !DOM_ENTRIES.has(entry)),
    entries.filter((entry) => DOM_ENTRIES.has(entry)),
];
let domWindow;

for (const [index, pass] of passes.entries()) {
    if (index === 1 && pass.length) {
        domWindow = installDom();
        stdout.write('jsdom globals installed\n');
    }
    for (const entry of pass) {
        const id = entry === '.' ? pkg.name : `${pkg.name}/${entry.slice(2)}`;
        let cjsFile;
        let esmFile;
        try {
            cjsFile = require.resolve(id);
            esmFile = fileURLToPath(import.meta.resolve(id));
        } catch (error) {
            fail(`${id} does not resolve: ${error.code ?? ''} ${error.message}`);
            continue;
        }
        if (
            !cjsFile.startsWith(join(BUILD, 'cjs') + sep) ||
            !esmFile.startsWith(join(BUILD, 'esm') + sep)
        ) {
            fail(
                `${id}: require resolves to ${relative(ROOT, cjsFile)}, ` +
                    `import to ${relative(ROOT, esmFile)}`,
            );
        }
        const cjs = await load(`require('${id}')`, () => require(id));
        const esm = await load(`import('${id}')`, () => import(id));
        if (!cjs || !esm) {
            continue;
        }
        const onlyCjs = cjs.filter((key) => !esm.includes(key));
        const onlyEsm = esm.filter((key) => !cjs.includes(key));
        if (onlyCjs.length || onlyEsm.length) {
            fail(
                `${id}: the builds export different names. ` +
                    `Only CommonJS: ${onlyCjs.join(', ') || '-'}. Only ESM: ${onlyEsm.join(', ') || '-'}.`,
            );
        }
    }
}

function report(label, names) {
    if (names.size) {
        stdout.write(`${label}: ${[...names].sort().join(', ')}\n`);
    }
}

report('build/esm imports through the `module` field', ownThroughModuleField);
for (const name of OWN_IMPORTS_THROUGH_MODULE_FIELD.keys()) {
    if (!ownThroughModuleField.has(name)) {
        stdout.write(`OWN_IMPORTS_THROUGH_MODULE_FIELD: ${name} is no longer needed\n`);
    }
}
report('Dependencies imported through the `module` field', dependenciesThroughModuleField);
report('Dependencies with extensionless or directory imports', dependenciesWithBundlerPaths);
report('ES modules reached by require(), CommonJS needs require(esm)', esmUnderRequire);

function* files(dir, suffix) {
    for (const item of readdirSync(dir)) {
        const file = join(dir, item);
        if (statSync(file).isDirectory()) {
            yield* files(file, suffix);
        } else if (file.endsWith(suffix)) {
            yield file;
        }
    }
}

// Specifiers of static imports, re-exports, dynamic imports, `import("…")` types and `require`.
const SPECIFIER =
    /(?:\b(?:import|export)\b[^'"`;]*?\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const REFERENCE_TYPES = /^\s*\/\/\/\s*<reference\s+types\s*=\s*['"]([^'"]+)['"]/gm;
const RESOLVED_EXTENSIONS = ['.js', '.css', '.json'];

function withoutComments(code) {
    return code
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
}

function specifiers(code) {
    return [...withoutComments(code).matchAll(SPECIFIER)].map(([, specifier]) => specifier);
}

function relativeSpecifiers(code) {
    return specifiers(code).filter((specifier) => specifier.startsWith('.'));
}

// A relative specifier must point to a file that exists (a `.js` one, in a `.d.ts`, to its
// declaration): a failed `.scss` compile leaves a `.css` import without its file.
function missingFiles(code, file) {
    const isDeclaration = file.endsWith('.d.ts');
    const missing = [...new Set(relativeSpecifiers(code))].filter((specifier) => {
        const path = resolve(dirname(file), specifier);
        if (isDeclaration) {
            return !existsSync(path.replace(/\.js$/, '.d.ts')) && !existsSync(`${path}.d.ts`);
        }
        return !existsSync(path);
    });
    return missing.length ? `relative import of a missing file: ${missing.join(', ')}` : undefined;
}

// `react` → `@types/react`; `@scope/name` → `@types/scope__name`.
function typesPackage(name) {
    return `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
}

function undeclaredPackages(code, file) {
    const isDeclaration = file.endsWith('.d.ts');
    const names = specifiers(code)
        .filter((specifier) => !specifier.startsWith('.') && !isBuiltin(specifier))
        .map(packageName);
    const referenced = [...code.matchAll(REFERENCE_TYPES)]
        .map(([, name]) => packageName(name))
        .filter((name) => !DECLARED.has(typesPackage(name)));
    const undeclared = [...new Set([...names, ...referenced])].filter(
        (name) => !DECLARED.has(name) && !(isDeclaration && TYPES_THROUGH_UIKIT.has(name)),
    );
    return undeclared.length
        ? `not in dependencies or peerDependencies: ${undeclared.join(', ')}`
        : undefined;
}

function scanBuild(format, check) {
    const problems = [];
    const dir = join(BUILD, format);
    for (const file of [...files(dir, '.js'), ...files(dir, '.d.ts')]) {
        const code = readFileSync(file, 'utf8');
        for (const problem of [
            check(code, file),
            missingFiles(code, file),
            undeclaredPackages(code, file),
        ]) {
            if (problem) {
                problems.push(`${relative(ROOT, file)}: ${problem}`);
            }
        }
    }
    if (problems.length) {
        fail(`build/${format} has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    } else {
        stdout.write(`build/${format}: all files pass the static scan\n`);
    }
}

scanBuild('cjs', (code, file) => {
    if (file.endsWith('.d.ts')) {
        return undefined;
    }
    const body = withoutComments(code);
    if (/^(import|export)\b/m.test(body)) {
        return 'ESM syntax in the CommonJS build';
    }
    if (/\bimport\s*\(/.test(body)) {
        return 'native import() in the CommonJS build';
    }
    return undefined;
});

scanBuild('esm', (code) => {
    const bad = relativeSpecifiers(code).filter(
        (specifier) => !RESOLVED_EXTENSIONS.some((extension) => specifier.endsWith(extension)),
    );
    return bad.length ? `relative import without an extension: ${bad.join(', ')}` : undefined;
});

domWindow?.close();

if (failed) {
    exit(1);
}
stdout.write('Both builds load through the package exports and export the same names.\n');
// jsdom or a dependency may leave handles open, which would keep the process alive.
exit(0);
