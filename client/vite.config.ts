import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';

/**
 * Plugin to strip import attributes from JSON imports so Rollup
 * doesn't complain about inconsistent `with { type: "json" }`.
 */
const jsonImportAttributesFix = (): Plugin => ({
  name: 'json-import-attributes-fix',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (options?.attributes?.type === 'json') {
      return this.resolve(source, importer, {
        ...options,
        skipSelf: true,
        attributes: {},
      });
    }
    return null;
  },
});

/**
 * Plugin to shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 */
const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'fs/promises' || source === 'fs' || source === 'net' || source === 'tty') {
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
    return null;
  },
});

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
