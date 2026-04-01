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
import { resolve } from 'path';
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
export default defineConfig({
    plugins: [
        jsonImportAttributesFix(),
        nodeBuiltinsShim(),
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
