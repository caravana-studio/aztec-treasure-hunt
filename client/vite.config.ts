import { createRequire } from 'module';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';

const require = createRequire(import.meta.url);

/**
 * Plugin to redirect bb.js Web Worker file requests to their real location.
 * bb.js spawns workers via `new Worker(new URL('./main.worker.js', import.meta.url))`.
 * When Vite pre-bundles bb.js, import.meta.url changes to .vite/deps/ but the
 * worker files aren't copied there — this plugin fixes that for dev and build.
 */
const bbWorkerPlugin = (): Plugin => {
  const workerFiles: Record<string, string> = {};
  return {
    name: 'bb-worker-redirect',
    configResolved(config) {
      try {
        const bbProverPath = require.resolve('@aztec/bb-prover');
        const bbRequire = createRequire(bbProverPath);
        const bbEntry = bbRequire.resolve('@aztec/bb.js');
        const bbRoot = bbEntry.slice(0, bbEntry.indexOf('@aztec/bb.js/') + '@aztec/bb.js/'.length);
        const bbBrowserDir = resolve(bbRoot, 'dest', 'browser', 'barretenberg_wasm');
        workerFiles['main.worker.js'] = resolve(bbBrowserDir, 'barretenberg_wasm_main', 'factory', 'browser', 'main.worker.js');
        workerFiles['thread.worker.js'] = resolve(bbBrowserDir, 'barretenberg_wasm_thread', 'factory', 'browser', 'thread.worker.js');
        config.logger.info(`[bb-worker-redirect] Resolved worker files in ${bbBrowserDir}`);
      } catch (err) {
        config.logger.warn(`[bb-worker-redirect] Could not resolve @aztec/bb.js workers: ${err}`);
      }
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        for (const [filename, realPath] of Object.entries(workerFiles)) {
          if (req.url.includes(filename) && req.url.includes('.vite/deps')) {
            req.url = `/@fs/${realPath}`;
            break;
          }
        }
        next();
      });
    },
  };
};

/**
 * Plugin to fix @alejoamiras/aztec-accelerator which is published with a broken
 * exports field (built files land in dist/src/ instead of dist/).
 */
const aztecAcceleratorResolve = (): Plugin => ({
  name: 'aztec-accelerator-resolve',
  enforce: 'pre',
  resolveId(source) {
    if (source === '@alejoamiras/aztec-accelerator') {
      return resolve(
        __dirname,
        'node_modules/@alejoamiras/aztec-accelerator/dist/src/index.js'
      );
    }
    return null;
  },
});

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
    aztecAcceleratorResolve(),
    bbWorkerPlugin(),
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
    dedupe: ['@aztec/foundation', '@aztec/circuits.js', '@noble/curves', '@aztec/bb-prover', '@aztec/bb.js'],
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
    target: 'esnext',
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
      '@alejoamiras/aztec-accelerator',
      '@aztec/bb.js',
      '@aztec/bb-prover',
      '@aztec/noir-acvm_js',
      '@aztec/noir-noirc_abi',
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
