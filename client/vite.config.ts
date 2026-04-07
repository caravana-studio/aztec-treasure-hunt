import { defineConfig, Plugin } from 'vite';
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
 * `ms` ships as CommonJS-only. When Vite serves the accelerator package directly
 * in dev, the browser sees `import ms from "ms"` and crashes before the app loads.
 * Intercept only that import edge and provide a tiny ESM-compatible shim.
 */
const acceleratorMsShim = (): Plugin => ({
  name: 'accelerator-ms-shim',
  enforce: 'pre',
  resolveId(source, importer) {
    if (
      source === 'ms' &&
      importer &&
      importer.includes('/@alejoamiras/aztec-accelerator/')
    ) {
      return '\0virtual:accelerator-ms';
    }
    return null;
  },
  load(id) {
    if (id !== '\0virtual:accelerator-ms') {
      return null;
    }

    return `
      const SECOND = 1000;
      const MINUTE = SECOND * 60;
      const HOUR = MINUTE * 60;
      const DAY = HOUR * 24;
      const WEEK = DAY * 7;
      const YEAR = DAY * 365.25;

      const UNITS = {
        y: YEAR,
        yr: YEAR,
        yrs: YEAR,
        year: YEAR,
        years: YEAR,
        w: WEEK,
        week: WEEK,
        weeks: WEEK,
        d: DAY,
        day: DAY,
        days: DAY,
        h: HOUR,
        hr: HOUR,
        hrs: HOUR,
        hour: HOUR,
        hours: HOUR,
        m: MINUTE,
        min: MINUTE,
        mins: MINUTE,
        minute: MINUTE,
        minutes: MINUTE,
        s: SECOND,
        sec: SECOND,
        secs: SECOND,
        second: SECOND,
        seconds: SECOND,
        ms: 1,
        msec: 1,
        msecs: 1,
        millisecond: 1,
        milliseconds: 1,
      };

      const PATTERN = /^(-?(?:\\d+)?\\.?\\d+)\\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i;

      const formatShort = (value) => {
        const absolute = Math.abs(value);
        if (absolute >= DAY) return Math.round(value / DAY) + 'd';
        if (absolute >= HOUR) return Math.round(value / HOUR) + 'h';
        if (absolute >= MINUTE) return Math.round(value / MINUTE) + 'm';
        if (absolute >= SECOND) return Math.round(value / SECOND) + 's';
        return value + 'ms';
      };

      const formatLong = (value) => {
        const absolute = Math.abs(value);

        const plural = (unitValue, unitName) => {
          const rounded = Math.round(value / unitValue);
          const suffix = absolute >= unitValue * 1.5 ? 's' : '';
          return rounded + ' ' + unitName + suffix;
        };

        if (absolute >= DAY) return plural(DAY, 'day');
        if (absolute >= HOUR) return plural(HOUR, 'hour');
        if (absolute >= MINUTE) return plural(MINUTE, 'minute');
        if (absolute >= SECOND) return plural(SECOND, 'second');
        return value + ' ms';
      };

      const parse = (value) => {
        const input = String(value).trim();
        const match = PATTERN.exec(input);
        if (!match) return undefined;

        const amount = Number.parseFloat(match[1]);
        const unit = (match[2] || 'ms').toLowerCase();
        const multiplier = UNITS[unit];
        return multiplier === undefined ? undefined : amount * multiplier;
      };

      export default function ms(value, options = {}) {
        if (typeof value === 'string' && value.length > 0) {
          return parse(value);
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return options.long ? formatLong(value) : formatShort(value);
        }
        throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(value));
      }
    `;
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

const patchAnonymousClassAssignments = (code: string) => {
  const anonymousClassAssignment =
    /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*=\s*class(\s*(?:extends\s+[^{]+)?\s*\{)/gm;

  return code.replace(anonymousClassAssignment, (_, prefix, className, suffix) => {
    return `${prefix}${className} = class ${className}${suffix}`;
  });
};

/**
 * Rollup rewrites some exported classes to `Foo = class extends ...` for live bindings.
 * That breaks self-referential static initializers such as `static ZERO = new Foo(0n)`.
 * Naming the class expression restores the local class binding without changing exports.
 */
const nameAnonymousClassAssignments = (): Plugin => ({
  name: 'name-anonymous-class-assignments',
  apply: 'build',
  writeBundle(outputOptions, bundle) {
    const outputDir = outputOptions.dir ? resolve(__dirname, outputOptions.dir) : resolve(__dirname, 'dist');

    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk' || !output.fileName.endsWith('.js')) {
        continue;
      }

      const patchedCode = patchAnonymousClassAssignments(output.code);
      if (patchedCode === output.code) {
        continue;
      }

      writeFileSync(resolve(outputDir, output.fileName), patchedCode);
    }
  },
});

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
