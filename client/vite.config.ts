import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';

/**
 * Plugin to shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 */
const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'fs/promises' || source === 'fs' || source === 'net' || source === 'tty' || source === 'pino') {
      return `\0virtual:${source}`;
    }
    return null;
  },
  load(id) {
    if (id === '\0virtual:fs/promises') {
      return `
        export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));
        export default { mkdir, writeFile, readFile, rm };
      `;
    }
    if (id === '\0virtual:fs') {
      return `
        export const existsSync = () => false;
        export const readFileSync = () => { throw new Error('fs not available in browser'); };
        export const writeFileSync = () => { throw new Error('fs not available in browser'); };
        export const mkdirSync = () => { throw new Error('fs not available in browser'); };
        export default { existsSync, readFileSync, writeFileSync, mkdirSync };
      `;
    }
    if (id === '\0virtual:net') {
      return `
        export const Socket = class Socket { constructor() { throw new Error('net not available in browser'); } }
        export const connect = () => { throw new Error('net not available in browser'); };
        export default { Socket, connect };
      `;
    }
    if (id === '\0virtual:tty') {
      return `
        export const isatty = () => false;
        export default { isatty };
      `;
    }
    if (id === '\0virtual:pino') {
      return `
        const noop = () => {};
        const createLogger = (opts) => ({
          info: noop,
          debug: noop,
          warn: noop,
          error: noop,
          fatal: noop,
          trace: noop,
          silent: noop,
          verbose: noop,
          child: (bindings, options) => createLogger(),
          level: 'info',
          isLevelEnabled: () => false,
          bindings: () => ({}),
          flush: noop,
          levels: { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } },
        });
        const pinoFn = createLogger;
        pinoFn.levels = { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } };
        export const pino = pinoFn;
        export const symbols = {
          needsMetadataGsym: Symbol('needsMetadata'),
          setLevelSym: Symbol('setLevel'),
          getLevelSym: Symbol('getLevel'),
          chindingsSym: Symbol('chindings'),
          parsedChindingsSym: Symbol('parsedChindings'),
          asJsonSym: Symbol('asJson'),
          writeSym: Symbol('write'),
          redactFmtSym: Symbol('redactFmt'),
          timeSym: Symbol('time'),
          timeSliceIndexSym: Symbol('timeSliceIndex'),
          streamSym: Symbol('stream'),
          stringifySym: Symbol('stringify'),
          stringifySafeSym: Symbol('stringifySafe'),
          stringifiersSym: Symbol('stringifiers'),
          endSym: Symbol('end'),
          formatOptsSym: Symbol('formatOpts'),
          messageKeySym: Symbol('messageKey'),
          errorKeySym: Symbol('errorKey'),
          nestedKeySym: Symbol('nestedKey'),
          wildcardFirstSym: Symbol('wildcardFirst'),
          formattersSym: Symbol('formatters'),
          useOnlyCustomLevelsSym: Symbol('useOnlyCustomLevels'),
          levelCompSym: Symbol('levelComp'),
          mixinSym: Symbol('mixin'),
          lsCacheSym: Symbol('lsCache'),
          hooksSym: Symbol('hooks'),
          nestedKeyStrSym: Symbol('nestedKeyStr'),
          mixinMergeStrategySym: Symbol('mixinMergeStrategy'),
          msgPrefixSym: Symbol('msgPrefix'),
        };
        export const levels = { values: { trace: 10, debug: 20, verbose: 25, info: 30, warn: 40, error: 50, fatal: 60 }, labels: { 10: 'trace', 20: 'debug', 25: 'verbose', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } };
        export const destination = () => ({ write: noop });
        export const transport = () => ({ write: noop });
        export const multistream = () => ({ write: noop });
        export const stdSerializers = { err: (e) => e, req: (r) => r, res: (r) => r };
        export default createLogger;
      `;
    }
    return null;
  },
});

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
      defaultIsModuleExports: (id) => {
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
        assetFileNames: (assetInfo) => {
          if ((assetInfo as any).name?.endsWith('.wasm')) {
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
