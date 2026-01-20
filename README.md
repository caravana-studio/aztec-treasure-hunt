# Treasure Hunt - Aztec

Un juego de dos jugadores construido sobre Aztec Protocol que demuestra el poder del estado privado en blockchain.

## Requisitos Previos

- **Node.js** v22 o superior
- **Yarn** 1.22+
- **Aztec CLI** instalado globalmente

```bash
# Instalar Aztec CLI
curl -L https://install.aztec.network | bash
aztec-up
```

## Estructura del Proyecto

```
treasure-hunt-aztec/
├── contracts/          # Contratos Noir/Aztec
│   ├── src/            # Código fuente Noir
│   ├── scripts/        # Scripts de deployment
│   └── config/         # Configuración de redes
├── client/             # Frontend React/Vite
│   ├── src/            # Código fuente React
│   └── scripts/        # Scripts de deployment del cliente
```

## Inicio Rápido

### 1. Iniciar la Red Local de Aztec

```bash
aztec start --local-network
```

> Mantener esta terminal abierta durante el desarrollo.

### 2. Compilar y Desplegar Contratos

```bash
cd contracts

# Instalar dependencias
yarn install

# Compilar contratos Noir
yarn compile

# Generar artefactos TypeScript
yarn codegen

# Desplegar contrato (requiere red local corriendo)
yarn deploy
```

### 3. Configurar y Ejecutar el Cliente

```bash
cd client

# Instalar dependencias
yarn install

```bash
# Iniciar servidor de desarrollo
yarn dev
```

El cliente estará disponible en `http://localhost:3001`

## Comandos Útiles

### Contratos

| Comando | Descripción |
|---------|-------------|
| `yarn compile` | Compilar contratos Noir |
| `yarn codegen` | Generar artefactos TypeScript |
| `yarn deploy` | Desplegar en red local |
| `yarn deploy::devnet` | Desplegar en devnet |
| `yarn test` | Ejecutar todos los tests |
| `yarn test:js` | Solo tests e2e TypeScript |
| `yarn test:nr` | Solo tests Noir TXE |
| `yarn clean` | Limpiar artefactos compilados |
| `yarn clear-store` | Limpiar store PXE |

### Cliente

| Comando | Descripción |
|---------|-------------|
| `yarn dev` | Iniciar servidor de desarrollo |
| `yarn build` | Compilar para producción |
| `yarn preview` | Previsualizar build de producción |
| `yarn deploy-contracts` | Desplegar contrato desde el cliente |

## Solución de Problemas

### Error de PXE después de reiniciar la red

```bash
cd contracts
yarn clear-store
```

### Artefactos no encontrados en el cliente

```bash
cd client
yarn copy-artifacts
```

### La red local no responde

Reiniciar la red:
```bash
# Ctrl+C para detener
aztec start --local-network
```

## Cómo Jugar

1. **Conectar cuenta**: Usa una cuenta de prueba o crea una nueva
2. **Crear/Unirse a partida**: Ingresa un ID de juego
3. **Colocar tesoros**: Selecciona 3 posiciones en la grilla
4. **Jugar**: Alterna turnos para excavar y encontrar tesoros del oponente
5. **Ganar**: El primero en encontrar 2 tesoros gana

### Acciones Disponibles

- **Dig**: Excavar una celda
- **Detector**: Detectar tesoros cercanos
- **Compass**: Obtener dirección hacia un tesoro
- **Shovel**: Mover tus tesoros (poder especial)
- **Trap**: Colocar una trampa

## Desarrollo

### Compilar todo desde cero

```bash
# Terminal 1 - Red Aztec
aztec start --local-network

# Terminal 2 - Contratos
cd contracts
yarn install
yarn compile && yarn codegen &&yarn deploy

# Terminal 3 - Cliente
cd client
yarn install
# Configurar .env con valores del deployment
yarn dev
```

### Ejecutar tests

```bash
# Desde contracts/
yarn test          # Todos los tests
yarn test:js       # Solo TypeScript e2e
yarn test:nr       # Solo Noir TXE
```

## Arquitectura

El juego utiliza el modelo híbrido público/privado de Aztec:

- **Estado Privado**: Posiciones de tesoros, trampas e inventario de poderes
- **Estado Público**: Jugadores, turnos, tesoros encontrados
- **Funciones Privadas**: `place_treasures`, `use_shovel`, `use_trap`
- **Funciones Públicas**: `create_game`, `join_game`, `dig`

## Licencia

MIT
