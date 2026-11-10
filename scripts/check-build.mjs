#!/usr/bin/env node
// Checks the built package (run `npm run build` first). Adapted from gravity-ui/chartkit#957.
//
// Load: `require` of build/cjs and `import` of build/esm for every entry point of the `exports`
// map, through the package's own name. Node resolves dashkit's files strictly, so a missing
// extension, a directory import or a CommonJS file with ESM syntax fails here. CSS and JSON are
// handled the way bundlers handle them: Node cannot load CSS, and imports JSON only with an import
// attribute (build/esm/i18n and uikit import it without one). `module.registerHooks` hooks run for
// both `import` and `require`, so `require.extensions` is not needed.
// Dependencies are resolved the way bundlers resolve them: a package without an `exports` map
// is imported through its `module` field, and inside the dependencies a specifier may omit `.js`
// or name a directory (the uikit 7 ESM build and its dependencies rely on all three). dashkit's own
// relative specifiers never get these rules; the packages that needed them are printed.
// ES modules reached through `require` are printed too: CommonJS consumers need require(esm) for
// them (Node 20.19+ / 22.12+). One of dashkit's own files among them is an error.
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
import {dirname, join, relative, resolve} from 'node:path';
import {exit, stderr, stdout} from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const {builtinModules, createRequire, registerHooks} = nodeModule;

if (!registerHooks) {
    stderr.write('check-build needs Node.js 22.15 or later (module.registerHooks).\n');
    exit(1);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILD = join(ROOT, 'build');
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

for (const format of ['cjs', 'esm']) {
    if (!existsSync(join(BUILD, format))) {
        stderr.write(`build/${format} is missing: run \`npm run build\` first.\n`);
        exit(1);
    }
}

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

function isDependencyFile(url) {
    return url !== undefined && url.includes('/node_modules/');
}

function isFile(path) {
    return existsSync(path) && statSync(path).isFile();
}

// A path the way bundlers resolve it: the file, the file with `.js`, or a directory through its
// own `package.json` (`module` before `main`) or its `index.js`. `isModule` marks a file reached
// through a `module` field: it is ESM whatever the package type says.
function resolvePath(path, isModule = false) {
    if (isFile(path)) {
        return {path, isModule};
    }
    if (isFile(`${path}.js`)) {
        return {path: `${path}.js`, isModule};
    }
    const manifest = join(path, 'package.json');
    if (isFile(manifest)) {
        const {module, main} = JSON.parse(readFileSync(manifest, 'utf8'));
        const resolved =
            (module && resolvePath(resolve(path, module), true)) ||
            (main && resolvePath(resolve(path, main), isModule));
        if (resolved) {
            return resolved;
        }
    }
    if (isFile(join(path, 'index.js'))) {
        return {path: join(path, 'index.js'), isModule};
    }
    return undefined;
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
const resolvedLikeBundlers = new Set();
const esmUnderRequire = new Set();

function bundlerResult(resolved, name) {
    resolvedLikeBundlers.add(name);
    return {
        url: pathToFileURL(resolved.path).href,
        ...(resolved.isModule ? {format: 'module'} : {}),
        shortCircuit: true,
    };
}

// Node's rules for dashkit's files. On top of them, as bundlers do: an `import` of a package
// without an `exports` map follows its `module` field, and inside the dependencies a specifier
// may omit `.js` or name a directory (the uikit 7 ESM build and its dependencies need both).
function resolveLikeBundlers(specifier, context, nextResolve) {
    const isBare =
        !specifier.startsWith('.') && !specifier.startsWith('/') && !isBuiltin(specifier);
    const isImport = context.conditions?.includes('import');
    const fromDependency = isDependencyFile(context.parentURL);
    if (isBare && isImport && context.parentURL) {
        const name = packageName(specifier);
        const found = packageWithoutExports(name, context.parentURL);
        if (found && (specifier === name ? found.manifest.module : fromDependency)) {
            const resolved = resolvePath(join(found.directory, specifier.slice(name.length)));
            if (resolved) {
                return bundlerResult(resolved, name);
            }
        }
    }
    try {
        return nextResolve(specifier, context);
    } catch (error) {
        if (!fromDependency || isBare || !RESOLUTION_ERRORS.includes(error.code)) {
            throw error;
        }
        const resolved = resolvePath(resolve(dirname(fileURLToPath(context.parentURL)), specifier));
        if (!resolved) {
            throw error;
        }
        return bundlerResult(resolved, packageOfUrl(context.parentURL));
    }
}

// The package a file of node_modules belongs to, for the report.
function packageOfUrl(url) {
    const path = url.slice(url.lastIndexOf('/node_modules/') + '/node_modules/'.length);
    return packageName(path);
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
        // An ES module loaded by `require()`.
        if (result.format === 'module' && context.conditions?.includes('require')) {
            if (isDependencyFile(url)) {
                esmUnderRequire.add(packageOfUrl(url));
            } else {
                fail(`build/cjs requires an ES module: ${relative(ROOT, fileURLToPath(url))}`);
            }
        }
        return result;
    },
});

function installDom() {
    // jsdom comes with jest-environment-jsdom, a devDependency.
    const requireFromJestEnvironment = createRequire(
        createRequire(import.meta.url).resolve('jest-environment-jsdom'),
    );
    const {JSDOM} = requireFromJestEnvironment('jsdom');
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

for (const target of new Set([...targets(pkg.exports), pkg.main, pkg.module, pkg.types])) {
    if (target && !existsSync(join(ROOT, target))) {
        fail(`package.json points to a missing file: ${target}`);
    }
}

const require = createRequire(import.meta.url);
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
        const cjsFile = require.resolve(id);
        const esmFile = fileURLToPath(import.meta.resolve(id));
        if (!cjsFile.startsWith(join(BUILD, 'cjs')) || !esmFile.startsWith(join(BUILD, 'esm'))) {
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

if (resolvedLikeBundlers.size) {
    stdout.write(`Resolved like a bundler: ${[...resolvedLikeBundlers].sort().join(', ')}\n`);
}
if (esmUnderRequire.size) {
    stdout.write(
        `ES modules loaded by require(), CommonJS needs require(esm): ${[...esmUnderRequire].sort().join(', ')}\n`,
    );
}

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

function undeclaredPackages(code, file) {
    const isDeclaration = file.endsWith('.d.ts');
    const names = specifiers(code)
        .filter((specifier) => !specifier.startsWith('.') && !isBuiltin(specifier))
        .map(packageName);
    const referenced = [...code.matchAll(REFERENCE_TYPES)]
        .map(([, name]) => name)
        .filter((name) => !DECLARED.has(`@types/${name}`));
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
