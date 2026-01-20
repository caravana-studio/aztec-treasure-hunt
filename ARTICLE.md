# Treasure Hunt: Un Juego que Demuestra el Verdadero Poder de la Privacidad en Blockchain

## Introducción

**Treasure Hunt** es un juego de dos jugadores construido sobre [Aztec Protocol](https://aztec.network) que demuestra capacidades de privacidad que son **imposibles de lograr** con esquemas tradicionales de commit-reveal.

En este artículo exploraremos cómo funciona el juego, por qué la privacidad de Aztec es fundamentalmente diferente, y cómo esto abre nuevas posibilidades para aplicaciones blockchain.

---

## El Juego en 30 Segundos

Imagina el clásico juego de "Batalla Naval", pero con superpoderes secretos:

1. **Jugador 1** esconde 3 tesoros en un tablero 8x8
2. **Jugador 2** se une y esconde sus 3 tesoros
3. Los jugadores se turnan para buscar los tesoros del oponente
4. **El primero en encontrar 2 tesoros del oponente gana**

Suena simple, pero los **poderes secretos** cambian todo.

---

## Los Poderes: Donde la Magia de Aztec Brilla

Cada jugador comienza con un inventario de poderes que **solo ellos conocen**:

| Poder | Cantidad | Descripción |
|-------|----------|-------------|
| 🔍 **Radar** (Metal Detector) | 3 | Escanea un área 3x3 y revela cuántos tesoros hay (sin posiciones exactas) |
| 🧭 **Brújula** (Compass) | 2 | Indica la distancia Manhattan al tesoro más cercano del oponente |
| ⛏️ **Pala Dorada** (Golden Shovel) | 1 | Mueve uno de tus propios tesoros a otra posición |
| 💣 **Trampa** (Trap) | 2 | Coloca una trampa invisible; el oponente pierde su turno si cava ahí |

### ¿Por qué estos poderes son especiales?

La **Pala Dorada** y las **Trampas** demuestran algo que ningún esquema commit-reveal puede hacer:

- **Cambiar estado privado después de que el juego comenzó**
- **Agregar nuevos elementos (trampas) dinámicamente**
- **Mantener el inventario completamente oculto**

---

## ¿Por qué Aztec y No Commit-Reveal?

### El Problema con Commit-Reveal

En un esquema tradicional de commit-reveal:

```
1. Jugador esconde tesoros
2. Crea hash: commitment = hash(posiciones + salt)
3. Publica commitment en blockchain
4. Más tarde, revela posiciones + salt para verificar
```

**Limitaciones críticas:**

| Problema | Explicación |
|----------|-------------|
| ❌ Estado inmutable | Una vez "commiteado", no puedes mover tesoros |
| ❌ Sin adiciones dinámicas | No puedes agregar trampas durante el juego |
| ❌ Inventario deducible | El oponente puede contar: "usó 2 radares, le queda 1" |
| ❌ Re-commits visibles | Si re-commiteas, el oponente sabe que algo cambió |

### La Solución de Aztec

Aztec usa un modelo de **notas privadas** (similar a UTXO) donde:

```
┌─────────────────────────────────────────────────────────┐
│                    ESTADO PÚBLICO                        │
│  - Quién juega                                          │
│  - De quién es el turno                                 │
│  - Cuántos tesoros ha encontrado cada jugador           │
│  - Quién ganó                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              ESTADO PRIVADO (Solo tú ves)               │
│  - Posiciones exactas de TUS tesoros                    │
│  - Posiciones de TUS trampas                            │
│  - Cuántos poderes TE quedan                            │
└─────────────────────────────────────────────────────────┘
```

**Beneficios únicos:**

| Capacidad | ¿Cómo funciona? |
|-----------|-----------------|
| ✅ Mover tesoros | La Pala Dorada "nullifica" la nota antigua y crea una nueva en otra posición |
| ✅ Trampas dinámicas | Se crean nuevas notas de trampa en cualquier momento |
| ✅ Inventario oculto | Las notas de poder se consumen sin revelar cuántas quedan |
| ✅ Sin re-commits | Los cambios de estado privado son invisibles para el oponente |

---

## El Bluff es Real: Estrategia Profunda

### Escenario 1: El Radar Fantasma

```
Inicio: Tienes 3 radares

Turno 5:  Usas radar en (2,3) → "1 tesoro detectado"
          Oponente ve: "Jugador A usó radar"

Turno 15: Oponente piensa: "¿Le quedarán radares?"

Realidad: Te quedan 2, pero él nunca lo sabrá
          Puedes fingir que ya no tienes y guardarlo para el final
```

### Escenario 2: La Pala Dorada Silenciosa

```
Inicio: Tu tesoro está en (5,5)

Turno 8:  Oponente usa brújula → "Distancia: 3"
          Empieza a acercarse a (5,5)

Turno 9:  Usas Pala Dorada (EN SECRETO)
          Mueves tesoro de (5,5) a (1,1)

Turno 10: Oponente cava en (5,5) → "¡Vacío!"
          Él piensa: "Calculé mal la brújula"

Realidad: Nunca sabrá que moviste el tesoro
```

### Escenario 3: Campo Minado Invisible

```
Turno 6:  Colocas trampa en (3,3)
Turno 8:  Colocas trampa en (4,4)

Turno 12: Oponente cava en (3,3) → "¡TRAMPA! Pierdes turno"

Pregunta: ¿Te quedan más trampas?
          Él no puede saberlo
          El miedo a otra trampa afecta su estrategia
```

---

## Flujo del Juego

```
┌──────────────────────────────────────────────────────────────┐
│                        FASE 1: SETUP                          │
├──────────────────────────────────────────────────────────────┤
│  Jugador 1                      │  Jugador 2                  │
│  ─────────                      │  ─────────                  │
│  1. Crea partida                │                             │
│  2. Espera...                   │  1. Se une a la partida     │
│  3. Coloca 3 tesoros (privado)  │  2. Coloca 3 tesoros        │
│  4. Recibe 8 poderes (privado)  │  3. Recibe 8 poderes        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      FASE 2: PLAYING                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Mientras nadie tenga 2 tesoros encontrados:                  │
│                                                               │
│    Turno del jugador actual:                                  │
│    ├─ Cavar (dig) en una posición                            │
│    │   └─ Resultado: Vacío / Tesoro / Trampa                 │
│    │                                                          │
│    ├─ Usar Radar (área 3x3)                                  │
│    │   └─ Oponente revela: "N tesoros en esa área"           │
│    │                                                          │
│    ├─ Usar Brújula                                           │
│    │   └─ Oponente revela: distancia al tesoro más cercano   │
│    │                                                          │
│    ├─ Usar Pala Dorada (secreto)                             │
│    │   └─ Mover uno de tus tesoros                           │
│    │                                                          │
│    └─ Colocar Trampa (secreto)                               │
│        └─ Trampa invisible en una posición                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      FASE 3: FINISHED                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  🏆 Gana el primer jugador en encontrar 2 tesoros            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Arquitectura Técnica

### Contratos en Noir (Lenguaje ZK de Aztec)

```
contracts/src/
├── main.nr           # Contrato principal TreasureHunt
├── treasure_note.nr  # Nota privada para posiciones de tesoros
├── trap_note.nr      # Nota privada para trampas
├── power_note.nr     # Nota privada para inventario de poderes
└── game.nr           # Estructura pública del juego
```

### Modelo de Ejecución Híbrido

Aztec usa un modelo único donde las funciones pueden ser **privadas** o **públicas**:

```
┌─────────────────────────────────────────────────────────────┐
│                   FUNCIONES PRIVADAS                         │
│            (Ejecutan en el cliente, crean pruebas ZK)        │
├─────────────────────────────────────────────────────────────┤
│  place_treasures()  → Coloca tesoros sin revelar posiciones │
│  use_shovel()       → Mueve tesoro (cambio de estado oculto)│
│  use_trap()         → Coloca trampa invisible               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ self.enqueue()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   FUNCIONES PÚBLICAS                         │
│               (Ejecutan on-chain, visibles)                  │
├─────────────────────────────────────────────────────────────┤
│  create_game()      → Crea nueva partida                    │
│  join_game()        → Unirse a partida existente            │
│  dig()              → Cavar en una posición                 │
│  confirm_*()        → Confirmar acciones privadas           │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de una Nota Privada

```noir
// Ejemplo: PowerNote (nota de poder)
#[note]
pub struct PowerNote {
    pub power_type: u8,      // 0=detector, 1=compass, 2=shovel, 3=trap
    pub owner: AztecAddress, // Solo el dueño puede ver/usar esta nota
}
```

**¿Cómo se consume un poder?**

1. Función privada busca una nota del tipo deseado
2. Si existe, la "nullifica" (marca como gastada)
3. **NO se reinserta** = el poder se consumió
4. El oponente solo ve que "algo pasó", no qué ni cuántos quedan

---

## Comparación Final: Aztec vs Commit-Reveal

| Característica | Commit-Reveal | Aztec |
|----------------|---------------|-------|
| Esconder estado inicial | ✅ Sí | ✅ Sí |
| Cambiar estado después | ❌ No (re-commit visible) | ✅ Sí (invisible) |
| Agregar estado dinámico | ❌ No | ✅ Sí |
| Inventario oculto | ❌ Deducible por conteo | ✅ Completamente privado |
| Verificabilidad | ✅ Al revelar | ✅ Pruebas ZK en tiempo real |
| Bluff estratégico | ❌ Limitado | ✅ Total |

---

## Conclusión

Treasure Hunt no es solo un juego—es una **demostración** de por qué la privacidad programable de Aztec representa un avance fundamental sobre los esquemas criptográficos tradicionales.

Los tres pilares que lo hacen posible:

1. **Estado privado mutable**: La Pala Dorada demuestra que puedes cambiar información secreta después de "commitearla"

2. **Adiciones dinámicas**: Las Trampas muestran que puedes agregar nuevo estado privado en cualquier momento

3. **Inventario verdaderamente oculto**: El conteo de poderes es imposible porque el oponente nunca ve el estado inicial ni los cambios

Esto abre posibilidades para:
- **Juegos de cartas** donde puedes cambiar tu mano
- **Subastas** donde puedes modificar tu oferta secretamente
- **Trading** donde tu inventario real permanece oculto
- **Cualquier aplicación** que requiera privacidad dinámica, no solo estática

---

## Prueba el Juego

```bash
# Requisitos
# - Node.js v22+
# - Aztec CLI instalado

# 1. Inicia la red local de Aztec
aztec start --local-network

# 2. Compila y despliega el contrato
cd contracts
yarn install
yarn compile && yarn codegen
yarn deploy

# 3. Inicia el cliente
cd ../client
yarn install
yarn dev

# 4. Abre http://localhost:3001 y juega!
```

---

## Links

- [Aztec Protocol](https://aztec.network)
- [Documentación de Aztec](https://docs.aztec.network)
- [Noir Language](https://noir-lang.org)

---

*Construido con Aztec Protocol - Privacidad programable para Ethereum*
