var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
/**
 * Plugin to fix @alejoamiras/aztec-accelerator which is published with a broken
 * exports field (built files land in dist/src/ instead of dist/).
 */
var aztecAcceleratorResolve = function () { return ({
    name: 'aztec-accelerator-resolve',
    enforce: 'pre',
    resolveId: function (source) {
        if (source === '@alejoamiras/aztec-accelerator') {
            return resolve(__dirname, 'node_modules/@alejoamiras/aztec-accelerator/dist/src/index.js');
        }
        return null;
    },
}); };
/**
 * `ms` ships as CommonJS-only. When Vite serves the accelerator package directly
 * in dev, the browser sees `import ms from "ms"` and crashes before the app loads.
 * Intercept only that import edge and provide a tiny ESM-compatible shim.
 */
var acceleratorMsShim = function () { return ({
    name: 'accelerator-ms-shim',
    enforce: 'pre',
    resolveId: function (source, importer) {
        if (source === 'ms' &&
            importer &&
            importer.includes('/@alejoamiras/aztec-accelerator/')) {
            return '\0virtual:accelerator-ms';
        }
        return null;
    },
    load: function (id) {
        if (id !== '\0virtual:accelerator-ms') {
            return null;
        }
        return "\n      const SECOND = 1000;\n      const MINUTE = SECOND * 60;\n      const HOUR = MINUTE * 60;\n      const DAY = HOUR * 24;\n      const WEEK = DAY * 7;\n      const YEAR = DAY * 365.25;\n\n      const UNITS = {\n        y: YEAR,\n        yr: YEAR,\n        yrs: YEAR,\n        year: YEAR,\n        years: YEAR,\n        w: WEEK,\n        week: WEEK,\n        weeks: WEEK,\n        d: DAY,\n        day: DAY,\n        days: DAY,\n        h: HOUR,\n        hr: HOUR,\n        hrs: HOUR,\n        hour: HOUR,\n        hours: HOUR,\n        m: MINUTE,\n        min: MINUTE,\n        mins: MINUTE,\n        minute: MINUTE,\n        minutes: MINUTE,\n        s: SECOND,\n        sec: SECOND,\n        secs: SECOND,\n        second: SECOND,\n        seconds: SECOND,\n        ms: 1,\n        msec: 1,\n        msecs: 1,\n        millisecond: 1,\n        milliseconds: 1,\n      };\n\n      const PATTERN = /^(-?(?:\\d+)?\\.?\\d+)\\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i;\n\n      const formatShort = (value) => {\n        const absolute = Math.abs(value);\n        if (absolute >= DAY) return Math.round(value / DAY) + 'd';\n        if (absolute >= HOUR) return Math.round(value / HOUR) + 'h';\n        if (absolute >= MINUTE) return Math.round(value / MINUTE) + 'm';\n        if (absolute >= SECOND) return Math.round(value / SECOND) + 's';\n        return value + 'ms';\n      };\n\n      const formatLong = (value) => {\n        const absolute = Math.abs(value);\n\n        const plural = (unitValue, unitName) => {\n          const rounded = Math.round(value / unitValue);\n          const suffix = absolute >= unitValue * 1.5 ? 's' : '';\n          return rounded + ' ' + unitName + suffix;\n        };\n\n        if (absolute >= DAY) return plural(DAY, 'day');\n        if (absolute >= HOUR) return plural(HOUR, 'hour');\n        if (absolute >= MINUTE) return plural(MINUTE, 'minute');\n        if (absolute >= SECOND) return plural(SECOND, 'second');\n        return value + ' ms';\n      };\n\n      const parse = (value) => {\n        const input = String(value).trim();\n        const match = PATTERN.exec(input);\n        if (!match) return undefined;\n\n        const amount = Number.parseFloat(match[1]);\n        const unit = (match[2] || 'ms').toLowerCase();\n        const multiplier = UNITS[unit];\n        return multiplier === undefined ? undefined : amount * multiplier;\n      };\n\n      export default function ms(value, options = {}) {\n        if (typeof value === 'string' && value.length > 0) {\n          return parse(value);\n        }\n        if (typeof value === 'number' && Number.isFinite(value)) {\n          return options.long ? formatLong(value) : formatShort(value);\n        }\n        throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(value));\n      }\n    ";
    },
}); };
/**
 * Plugin to strip import attributes from JSON imports so Rollup
 * doesn't complain about inconsistent `with { type: "json" }`.
 */
var jsonImportAttributesFix = function () { return ({
    name: 'json-import-attributes-fix',
    enforce: 'pre',
    resolveId: function (source, importer, options) {
        var _a;
        if (((_a = options === null || options === void 0 ? void 0 : options.attributes) === null || _a === void 0 ? void 0 : _a.type) === 'json') {
            return this.resolve(source, importer, __assign(__assign({}, options), { skipSelf: true, attributes: {} }));
        }
        return null;
    },
}); };
/**
 * Plugin to shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 */
var nodeBuiltinsShim = function () { return ({
    name: 'node-builtins-shim',
    enforce: 'pre',
    resolveId: function (source) {
        if (source === 'fs/promises' || source === 'fs' || source === 'net' || source === 'tty') {
            return "\0virtual:".concat(source);
        }
        return null;
    },
    load: function (id) {
        if (id === '\0virtual:fs/promises') {
            return "\n        export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));\n        export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));\n        export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));\n        export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));\n        export default { mkdir, writeFile, readFile, rm };\n      ";
        }
        if (id === '\0virtual:fs') {
            return "\n        export const existsSync = () => false;\n        export const readFileSync = () => { throw new Error('fs not available in browser'); };\n        export const writeFileSync = () => { throw new Error('fs not available in browser'); };\n        export const mkdirSync = () => { throw new Error('fs not available in browser'); };\n        export default { existsSync, readFileSync, writeFileSync, mkdirSync };\n      ";
        }
        if (id === '\0virtual:net') {
            return "\n        export const Socket = class Socket { constructor() { throw new Error('net not available in browser'); } }\n        export const connect = () => { throw new Error('net not available in browser'); };\n        export default { Socket, connect };\n      ";
        }
        if (id === '\0virtual:tty') {
            return "\n        export const isatty = () => false;\n        export default { isatty };\n      ";
        }
        return null;
    },
}); };
var patchAnonymousClassAssignments = function (code) {
    var anonymousClassAssignment = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*=\s*class(\s*(?:extends\s+[^{]+)?\s*\{)/gm;
    return code.replace(anonymousClassAssignment, function (_, prefix, className, suffix) {
        return "".concat(prefix).concat(className, " = class ").concat(className).concat(suffix);
    });
};
/**
 * Rollup rewrites some exported classes to `Foo = class extends ...` for live bindings.
 * That breaks self-referential static initializers such as `static ZERO = new Foo(0n)`.
 * Naming the class expression restores the local class binding without changing exports.
 */
var nameAnonymousClassAssignments = function () { return ({
    name: 'name-anonymous-class-assignments',
    apply: 'build',
    writeBundle: function (outputOptions, bundle) {
        var outputDir = outputOptions.dir ? resolve(__dirname, outputOptions.dir) : resolve(__dirname, 'dist');
        for (var _i = 0, _a = Object.values(bundle); _i < _a.length; _i++) {
            var output = _a[_i];
            if (output.type !== 'chunk' || !output.fileName.endsWith('.js')) {
                continue;
            }
            var patchedCode = patchAnonymousClassAssignments(output.code);
            if (patchedCode === output.code) {
                continue;
            }
            writeFileSync(resolve(outputDir, output.fileName), patchedCode);
        }
    },
}); };
export default defineConfig({
    plugins: [
        aztecAcceleratorResolve(),
        acceleratorMsShim(),
        jsonImportAttributesFix(),
        nodeBuiltinsShim(),
        nameAnonymousClassAssignments(),
        react(),
        wasm(),
        topLevelAwait(),
        nodePolyfills({
            include: ['buffer', 'crypto', 'util', 'assert', 'process', 'stream', 'path', 'events'],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            exclude: ['fs', 'net', 'tty'],
        }),
    ],
    assetsInclude: ['**/*.wasm'],
    define: {
        global: 'globalThis',
    },
    worker: {
        format: 'es',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            crypto: 'crypto-browserify',
            stream: 'stream-browserify',
            util: 'util',
            path: 'path-browserify',
            'pino': 'pino/browser.js',
            'hash.js': 'hash.js/lib/hash.js',
            'sha3': 'sha3/index.js',
            'lodash.chunk': 'lodash.chunk/index.js',
            'lodash.times': 'lodash.times/index.js',
            'lodash.isequal': 'lodash.isequal/index.js',
            'lodash.pickby': 'lodash.pickby/index.js',
            'json-stringify-deterministic': 'json-stringify-deterministic/lib/index.js',
        },
        dedupe: ['@aztec/foundation', '@aztec/circuits.js', '@noble/curves'],
    },
    server: {
        port: 3001,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
        fs: {
            allow: ['..'],
        },
    },
    preview: {
        port: 3000,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    },
    build: {
        target: 'es2022',
        sourcemap: false,
        // esbuild 0.25 is breaking Aztec field class initialization in production bundles.
        minify: false,
        chunkSizeWarningLimit: 2000,
        commonjsOptions: {
            defaultIsModuleExports: function (id) {
                if (id.includes('@aztec/')) {
                    return false;
                }
                return 'auto';
            },
        },
        rollupOptions: {
            output: {
                format: 'es',
                preserveModules: false,
                inlineDynamicImports: false,
                interop: 'auto',
                assetFileNames: function (assetInfo) {
                    var _a;
                    if ((_a = assetInfo.name) === null || _a === void 0 ? void 0 : _a.endsWith('.wasm')) {
                        return 'assets/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'buffer',
            'crypto-browserify',
            'stream-browserify',
            'util',
            'path-browserify',
            'hash.js',
            'lodash.chunk',
            'lodash.times',
            'lodash.clonedeep',
            'lodash.isequal',
            'lodash.omit',
            'json-stringify-deterministic',
            'bn.js',
            'minimalistic-assert',
            'inherits',
            'elliptic',
            'brorand',
            'hmac-drbg',
        ],
        exclude: [
            '@alejoamiras/aztec-accelerator',
            '@aztec/bb.js',
            '@aztec/pxe',
            '@aztec/pxe/client/lazy',
            '@aztec/pxe/client/bundle',
            '@aztec/foundation',
            '@aztec/circuits.js',
            '@aztec/noir-contracts.js',
            '@aztec/accounts',
            '@aztec/kv-store',
            '@aztec/wallets',
        ],
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },
});
