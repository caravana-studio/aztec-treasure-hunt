import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';
/**
 * Plugin to shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 */
var nodeBuiltinsShim = function () { return ({
    name: 'node-builtins-shim',
    enforce: 'pre',
    resolveId: function (source) {
        if (source === 'fs/promises' || source === 'fs' || source === 'net' || source === 'tty' || source === 'pino') {
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
        if (id === '\0virtual:pino') {
            return "\n        const noop = () => {};\n        const createLogger = (opts) => ({\n          info: noop,\n          debug: noop,\n          warn: noop,\n          error: noop,\n          fatal: noop,\n          trace: noop,\n          silent: noop,\n          verbose: noop,\n          child: (bindings, options) => createLogger(),\n          level: 'info',\n          isLevelEnabled: () => false,\n          bindings: () => ({}),\n          flush: noop,\n          levels: { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } },\n        });\n        const pinoFn = createLogger;\n        pinoFn.levels = { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } };\n        export const pino = pinoFn;\n        export const symbols = {\n          needsMetadataGsym: Symbol('needsMetadata'),\n          setLevelSym: Symbol('setLevel'),\n          getLevelSym: Symbol('getLevel'),\n          chindingsSym: Symbol('chindings'),\n          parsedChindingsSym: Symbol('parsedChindings'),\n          asJsonSym: Symbol('asJson'),\n          writeSym: Symbol('write'),\n          redactFmtSym: Symbol('redactFmt'),\n          timeSym: Symbol('time'),\n          timeSliceIndexSym: Symbol('timeSliceIndex'),\n          streamSym: Symbol('stream'),\n          stringifySym: Symbol('stringify'),\n          stringifySafeSym: Symbol('stringifySafe'),\n          stringifiersSym: Symbol('stringifiers'),\n          endSym: Symbol('end'),\n          formatOptsSym: Symbol('formatOpts'),\n          messageKeySym: Symbol('messageKey'),\n          errorKeySym: Symbol('errorKey'),\n          nestedKeySym: Symbol('nestedKey'),\n          wildcardFirstSym: Symbol('wildcardFirst'),\n          formattersSym: Symbol('formatters'),\n          useOnlyCustomLevelsSym: Symbol('useOnlyCustomLevels'),\n          levelCompSym: Symbol('levelComp'),\n          mixinSym: Symbol('mixin'),\n          lsCacheSym: Symbol('lsCache'),\n          hooksSym: Symbol('hooks'),\n          nestedKeyStrSym: Symbol('nestedKeyStr'),\n          mixinMergeStrategySym: Symbol('mixinMergeStrategy'),\n          msgPrefixSym: Symbol('msgPrefix'),\n        };\n        export const levels = { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } };\n        export const destination = () => ({ write: noop });\n        export const transport = () => ({ write: noop });\n        export const multistream = () => ({ write: noop });\n        export const stdSerializers = { err: (e) => e, req: (r) => r, res: (r) => r };\n        export default createLogger;\n      ";
        }
        return null;
    },
}); };
export default defineConfig({
    plugins: [
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
            'sha3': resolve(__dirname, 'src/shims/sha3-shim.ts'),
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
        sourcemap: false,
        minify: 'esbuild',
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
            '@aztec/foundation',
            '@aztec/circuits.js',
            '@aztec/noir-contracts.js',
            '@aztec/accounts',
        ],
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },
});
