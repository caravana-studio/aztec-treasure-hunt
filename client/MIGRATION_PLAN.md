# Plan de Migración: Client → Boilerplate Architecture

## Resumen

Este plan migra el proyecto `client` hacia la arquitectura del `aztec-web-boilerplate`, manteniendo la lógica del juego pero modernizando la infraestructura.

---

## Fase 1: Limpieza Inmediata (Sin romper nada)

### 1.1 Eliminar archivos innecesarios

```bash
# Archivos a eliminar
client/vite.config.js      # Compilado innecesario (se usa .ts)
client/vite.config.d.ts    # Tipos generados innecesarios
client/webpack.config.js   # No se usa (residuo)
```

### 1.2 Simplificar dependencias en package.json

**Eliminar:**
- `@aztec/test-wallet` - No se usa en producción
- `js-sha3` - Duplicado (sha3 es suficiente)

**Agregar:**
- `@aztec/aztec` - Paquete umbrella del boilerplate

---

## Fase 2: Simplificar Vite Config

### 2.1 Problema actual

El `vite.config.ts` tiene un shim de `pino` de ~75 líneas que es innecesario.

### 2.2 Solución

Reemplazar el shim complejo por alias simples del boilerplate:

```typescript
// ANTES (complejo - 75 líneas de shim)
if (source === 'pino') {
  return `\0virtual:${source}`;
}
// ... implementación compleja

// DESPUÉS (simple - 1 línea)
alias: {
  'pino': 'pino/browser.js',
}
```

### 2.3 Cambios específicos en vite.config.ts

1. **Eliminar** el shim virtual de `pino` (líneas 16-90 aprox)
2. **Agregar** aliases del boilerplate:
   ```typescript
   alias: {
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
   }
   ```
3. **Eliminar** el archivo `src/shims/sha3-shim.ts`

---

## Fase 3: Estado Global con Zustand

### 3.1 Estructura propuesta

```
src/
├── store/
│   ├── wallet/
│   │   └── walletStore.ts    # Estado del wallet
│   ├── game/
│   │   └── gameStore.ts      # Estado del juego
│   └── index.ts              # Re-exports
```

### 3.2 Migración de WalletContext a Zustand

**Actual (`src/context/WalletContext.tsx`):**
```typescript
// Context API con useState
const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
const [myAddress, setMyAddress] = useState<AztecAddress | null>(null);
```

**Propuesto (`src/store/wallet/walletStore.ts`):**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  wallet: EmbeddedWallet | null;
  address: AztecAddress | null;
  status: 'disconnected' | 'connecting' | 'connected';

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setWallet: (wallet: EmbeddedWallet) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      wallet: null,
      address: null,
      status: 'disconnected',

      connect: async () => {
        set({ status: 'connecting' });
        // ... lógica de conexión
        set({ status: 'connected', wallet, address });
      },

      disconnect: () => {
        set({ wallet: null, address: null, status: 'disconnected' });
      },
    }),
    { name: 'wallet-storage' }
  )
);
```

### 3.3 Migración del hook useGame

**Actual (`src/hooks/useGame.ts`):**
- Hook con múltiples `useState`
- Lógica mezclada con estado

**Propuesto (`src/store/game/gameStore.ts`):**
```typescript
interface GameState {
  gameId: Fr | null;
  gameState: GameStruct | null;
  isMyTurn: boolean;
  logs: GameLog[];

  // Actions
  createGame: () => Promise<void>;
  joinGame: (gameId: Fr) => Promise<void>;
  dig: (x: number, y: number) => Promise<void>;
  usePower: (power: PowerType) => Promise<void>;
  addLog: (log: GameLog) => void;
}
```

---

## Fase 4: Reorganización de Estructura

### 4.1 Estructura actual

```
src/
├── artifacts/TreasureHunt.ts
├── components/
│   ├── GameGrid.tsx
│   ├── GameLogs.tsx
│   ├── PlayerCard.tsx
│   ├── PowersPanel.tsx
│   └── TurnIndicator.tsx
├── context/WalletContext.tsx
├── hooks/useGame.ts
├── pages/
│   ├── Game.tsx
│   └── Lobby.tsx
├── shims/sha3-shim.ts        # ELIMINAR
├── styles/
│   ├── game.css
│   ├── glass.css
│   └── index.css
├── App.tsx
├── embedded-wallet.ts
└── main.tsx
```

### 4.2 Estructura propuesta

```
src/
├── artifacts/
│   └── TreasureHunt.ts
├── components/
│   ├── game/                  # Componentes del juego
│   │   ├── GameGrid.tsx
│   │   ├── GameLogs.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── PowersPanel.tsx
│   │   └── TurnIndicator.tsx
│   └── ui/                    # Componentes reutilizables (opcional)
│       └── Button.tsx
├── config/
│   └── network.ts             # Configuración de red
├── hooks/
│   ├── useGame.ts             # Simplificado (usa store)
│   └── useWallet.ts           # Hook que expone walletStore
├── pages/
│   ├── Game.tsx
│   └── Lobby.tsx
├── services/
│   └── aztec/
│       └── pxeService.ts      # PXE como singleton
├── store/
│   ├── wallet/
│   │   └── walletStore.ts
│   ├── game/
│   │   └── gameStore.ts
│   └── index.ts
├── styles/
│   ├── game.css
│   ├── glass.css
│   └── index.css
├── types/
│   └── game.ts                # Tipos del juego
├── App.tsx
└── main.tsx
```

---

## Fase 5: Refactorizar embedded-wallet.ts

### 5.1 Problema actual

`embedded-wallet.ts` (365 líneas) es una clase monolítica que mezcla:
- Inicialización de PXE
- Gestión de cuentas
- Almacenamiento en localStorage
- Fee payments

### 5.2 Solución: Separar responsabilidades

**5.2.1 PXE Service (`src/services/aztec/pxeService.ts`):**
```typescript
// Singleton para PXE compartido
export class PXEService {
  private static instance: PXE | null = null;

  static async getInstance(nodeUrl: string): Promise<PXE> {
    if (!this.instance) {
      const aztecNode = createAztecNodeClient(nodeUrl);
      const config = getPXEConfig();
      this.instance = await createPXE(aztecNode, config);
    }
    return this.instance;
  }
}
```

**5.2.2 Account Service (`src/services/aztec/accountService.ts`):**
```typescript
// Gestión de cuentas separada
export class AccountService {
  async createAccount(): Promise<AccountWithSecretKey> { ... }
  async loadAccount(stored: StoredAccount): Promise<Account> { ... }
  saveAccount(account: AccountWithSecretKey): void { ... }
}
```

**5.2.3 Fee Service (`src/services/aztec/feeService.ts`):**
```typescript
// Fee payments separado
export class FeeService {
  async getSponsoredFeePaymentMethod(): Promise<FeePaymentMethod> { ... }
}
```

---

## Fase 6: UI con Tailwind (Opcional)

### 6.1 Instalar Tailwind

```bash
yarn add tailwindcss @tailwindcss/postcss autoprefixer postcss
```

### 6.2 Migrar CSS gradualmente

No es necesario migrar todo de una vez. Se puede:
1. Mantener `glass.css` y `game.css` existentes
2. Usar Tailwind para nuevos componentes
3. Migrar componentes uno a uno cuando se modifiquen

---

## Fase 7: Testing (Opcional)

### 7.1 Agregar Vitest

```bash
yarn add -D vitest @vitest/ui jsdom
```

### 7.2 Configuración básica

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

---

## Orden de Ejecución Recomendado

| Paso | Fase | Impacto | Dificultad |
|------|------|---------|------------|
| 1 | 1.1 | Bajo | Fácil |
| 2 | 1.2 | Bajo | Fácil |
| 3 | 2 | Medio | Medio |
| 4 | 3 | Alto | Medio |
| 5 | 4 | Bajo | Fácil |
| 6 | 5 | Alto | Alto |
| 7 | 6 | Medio | Medio |
| 8 | 7 | Bajo | Fácil |

---

## Checklist de Migración

### Fase 1 - Limpieza
- [ ] Eliminar `vite.config.js`
- [ ] Eliminar `vite.config.d.ts`
- [ ] Eliminar `webpack.config.js`
- [ ] Eliminar `@aztec/test-wallet` de dependencies
- [ ] Eliminar `js-sha3` de dependencies

### Fase 2 - Vite
- [ ] Simplificar nodeBuiltinsShim (eliminar shim de pino)
- [ ] Agregar aliases del boilerplate
- [ ] Eliminar `src/shims/sha3-shim.ts`
- [ ] Probar que `yarn dev` funciona

### Fase 3 - Zustand
- [ ] Instalar zustand
- [ ] Crear `src/store/wallet/walletStore.ts`
- [ ] Crear `src/store/game/gameStore.ts`
- [ ] Migrar WalletContext a usar walletStore
- [ ] Actualizar componentes que usan WalletContext

### Fase 4 - Estructura
- [ ] Mover componentes a `components/game/`
- [ ] Crear `src/config/network.ts`
- [ ] Crear `src/types/game.ts`

### Fase 5 - Servicios
- [ ] Crear `src/services/aztec/pxeService.ts`
- [ ] Crear `src/services/aztec/accountService.ts`
- [ ] Refactorizar `embedded-wallet.ts`

### Fase 6 - UI (Opcional)
- [ ] Instalar Tailwind
- [ ] Configurar PostCSS
- [ ] Migrar componentes gradualmente

### Fase 7 - Testing (Opcional)
- [ ] Instalar Vitest
- [ ] Configurar vitest.config.ts
- [ ] Agregar tests básicos

---

## Notas Importantes

1. **No romper el juego**: Cada fase debe mantener el juego funcional
2. **Commits frecuentes**: Un commit por sub-tarea
3. **Probar después de cada cambio**: `yarn dev` debe funcionar
4. **Fases opcionales**: 6 y 7 pueden omitirse inicialmente

## Archivos de Referencia del Boilerplate

- `aztec-web-boilerplate/vite.config.ts` - Configuración de Vite limpia
- `aztec-web-boilerplate/src/store/` - Ejemplos de Zustand
- `aztec-web-boilerplate/src/services/aztec/` - Servicios de Aztec
- `aztec-web-boilerplate/src/connectors/` - Conectores de wallet
