# Treasure Hunt: Privacidad Dinámica en Blockchain

## El Juego

**Treasure Hunt** es un juego de dos jugadores sobre [Aztec Protocol](https://aztec.network) que demuestra capacidades de privacidad imposibles con commit-reveal.

**Reglas básicas:**
1. Cada jugador esconde 3 tesoros en un tablero 8x8
2. Se turnan para buscar los tesoros del oponente
3. El primero en encontrar 2 tesoros gana

**Poderes disponibles:**

| Poder | Cant. | Efecto | Visibilidad |
|-------|-------|--------|-------------|
| 🔍 Radar | 3 | Escanea área 3x3, revela cantidad de tesoros | Pública |
| 🧭 Brújula | 2 | Distancia Manhattan al tesoro más cercano | Pública |
| ⛏️ Pala Dorada | 1 | Mueve uno de tus tesoros | Invisible |
| 💣 Trampa | 2 | El oponente pierde turno si cava ahí | Invisible |

---

## ¿Por qué Aztec y No Commit-Reveal?

En commit-reveal, publicas `hash(estado + salt)` al inicio. Problema: el estado queda fijo.

**Lo que Aztec permite que commit-reveal no puede:**

| Capacidad | Commit-Reveal | Aztec |
|-----------|---------------|-------|
| Mover tesoros después de iniciar | ❌ Re-commit visible | ✅ Cambio invisible |
| Agregar trampas durante el juego | ❌ No estaban en el commit | ✅ Estado dinámico |
| Acciones indistinguibles | ❌ Cada acción es única | ✅ Pala y Trampa se confunden |

**El modelo híbrido:**

```
PÚBLICO                              PRIVADO
─────────────────────────────────    ─────────────────────────────────
• Turnos y jugadores                 • Posiciones de tesoros
• Resultados de excavaciones         • Posiciones de trampas
• Uso de Radar/Brújula (contable)    • ¿Fue Pala o Trampa? (no se sabe)
```

**Clave:** Radar y Brújula son deducibles por descarte (uso público, cantidad inicial conocida). Pero Pala y Trampa son **indistinguibles** - el oponente solo ve que "pasó el turno sin acción pública".

---

## Estrategia: La Confusión Pala/Trampa

El oponente tiene 1 Pala + 2 Trampas = 3 "acciones invisibles". Cuando usa una, no sabes cuál fue:

```
Turno 6:  Oponente hace algo invisible  → ¿Pala o Trampa?
Turno 10: Oponente hace algo invisible  → ¿Cuántas trampas quedan?
Turno 12: Cavas en (3,3) → ¡TRAMPA!     → Ahora sabes que UNA fue trampa

Pero la otra... ¿fue Pala (movió tesoro) o segunda Trampa (hay otra)?
No puedes saberlo.
```

**Escenario clásico:**
```
Tu tesoro está en (5,5)
Oponente usa brújula → "Distancia: 3" → Empieza a acercarse

Usas Pala Dorada → Mueves tesoro a (1,1)
Oponente ve: "hizo algo invisible"

Oponente cava en (5,5) → ¡Vacío!
Él piensa: "¿Calculé mal o movió el tesoro?"
```

---

## Flujo del Juego

```
SETUP                           PLAYING                         FIN
─────                           ───────                         ───
• Crear/unirse a partida        • Cavar (público)               • 2 tesoros
• Colocar 3 tesoros (privado)   • Radar/Brújula (público)         encontrados
• Recibir 8 poderes             • Pala/Trampa (invisible)       • Hay ganador
```

---

## Arquitectura

```
contracts/src/
├── main.nr           # Contrato principal
├── treasure_note.nr  # Nota privada: posición de tesoro
├── trap_note.nr      # Nota privada: posición de trampa
├── power_note.nr     # Nota privada: poder disponible
└── game.nr           # Estado público del juego
```

**Ejecución híbrida:**
- Funciones privadas (`use_shovel`, `use_trap`) ejecutan en el cliente y crean pruebas ZK
- Funciones públicas (`dig`, `create_game`) ejecutan on-chain
- Puente: `self.enqueue()` llama público desde privado

---

## Conclusión

Treasure Hunt demuestra tres capacidades únicas de Aztec:

1. **Estado privado mutable** - Mover tesoros sin que nadie lo sepa
2. **Adiciones dinámicas** - Agregar trampas en cualquier momento
3. **Acciones indistinguibles** - Pala y Trampa crean incertidumbre real

No todo es privado (Radar/Brújula son públicos), pero Aztec permite diseñar exactamente qué información revelar.

---

## Prueba el Juego

```bash
# 1. Red local de Aztec
aztec start --local-network

# 2. Contratos
cd contracts && yarn install
yarn compile && yarn codegen && yarn deploy

# 3. Cliente
cd ../client && yarn install && yarn dev
# Abrir http://localhost:3001
```

---

[Aztec Protocol](https://aztec.network) | [Documentación](https://docs.aztec.network) | [Noir Language](https://noir-lang.org)
