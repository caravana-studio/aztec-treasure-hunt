# Tu oponente acaba de hacer algo. No sabes qué.

Estás jugando Treasure Hunt. Tu oponente pasa su turno sin hacer nada visible.

¿Movió su tesoro a otra casilla? ¿Puso una trampa donde planeas cavar? No hay forma de saberlo. Solo sabes que *algo* cambió.

Esa incertidumbre genuina no existe en ningún otro juego on-chain.

---

## El problema con los juegos en blockchain

Los juegos on-chain tienen dos opciones, ambas malas:

**Todo público:** Imagina jugar Batalla Naval donde tu oponente ve exactamente dónde están tus barcos. No hay estrategia posible.

**Commit-reveal:** Publicas un hash de tu estado al inicio. Funciona para estados fijos, pero tiene un problema fundamental: *tu estrategia queda congelada*. No puedes cambiar nada después del commit inicial sin delatarte.

¿Qué pasa si quieres un juego donde puedas adaptarte durante la partida? ¿Mover piezas secretamente? ¿Agregar trampas que no existían al inicio?

Con commit-reveal, simplemente no se puede.

---

## Treasure Hunt: un juego que no debería ser posible

Treasure Hunt es un juego de dos jugadores donde cada uno esconde 3 tesoros en un tablero 8x8. Se turnan para buscar los tesoros del oponente. El primero en encontrar 2 gana.

Hasta ahí, suena como Batalla Naval. La diferencia está en los poderes:

| Poder | Qué hace |
|-------|----------|
| **Radar** | Escanea un área 3x3, revela cuántos tesoros hay |
| **Brújula** | Da la distancia al tesoro más cercano |
| **Pala Dorada** | Mueve uno de tus tesoros a otra casilla |
| **Trampa** | Si el oponente cava ahí, pierde su turno |

Radar y Brújula son públicos: cuando los usas, tu oponente lo sabe.

Pala Dorada y Trampa son invisibles: tu oponente solo ve que "pasaste el turno".

Acá está lo interesante: **Pala y Trampa son indistinguibles**. Cuando tu oponente hace una acción invisible, no sabes si movió su tesoro o puso una trampa. Ambas lucen exactamente igual desde afuera.

---

## Un turno que cambia todo

Imagina esta situación:

```
Tu tesoro está en (5,5).
Tu oponente usa Brújula → "Distancia: 3"
Está triangulando. Se acerca.

Usas Pala Dorada → Mueves el tesoro a (1,1)
Tu oponente ve: "hizo algo invisible"

Siguiente turno, cava en (5,5) → Vacío.
```

¿Calculó mal la distancia? ¿O moviste el tesoro? Él no puede saberlo.

Ahora imagina el otro lado. Tu oponente tiene 1 Pala + 2 Trampas = 3 acciones invisibles:

```
Turno 6:  Hace algo invisible  → ¿Pala o Trampa?
Turno 10: Hace algo invisible  → ¿Cuántas trampas quedan?
Turno 12: Cavas en (3,3) → ¡TRAMPA!

Una era trampa. Pero la otra... ¿fue Pala o la segunda Trampa?
No hay forma de saberlo.
```

Cada acción invisible agrega incertidumbre. ¿El tesoro sigue donde estaba? ¿Hay trampas esperándote? La información es genuinamente privada, no solo oculta temporalmente.

---

## Por qué esto no funciona con commit-reveal

Con commit-reveal, publicas `hash(posiciones + salt)` al inicio. El estado queda grabado en piedra.

| Lo que quieres hacer | Commit-reveal | Aztec |
|---------------------|---------------|-------|
| Mover tesoros después de empezar | Necesitas re-commit (visible, te delata) | Cambio invisible |
| Poner trampas durante la partida | Imposible, no estaban en el commit original | Sin problema |
| Acciones indistinguibles | Cada tipo de acción deja huella diferente | Pala y Trampa lucen igual |

La diferencia fundamental: en commit-reveal el estado privado es *estático*. En Aztec es *dinámico*. Puedes modificarlo, agregar cosas nuevas, y el oponente solo ve que algo cambió, sin saber qué.

---

## Privacidad selectiva

No todo en Treasure Hunt es privado. El juego mezcla deliberadamente información pública y privada:

```
PÚBLICO                              PRIVADO
─────────────────────────────────    ─────────────────────────────────
• De quién es el turno               • Dónde están los tesoros
• Resultados de excavaciones         • Dónde están las trampas
• Cuándo se usa Radar o Brújula      • ¿Fue Pala o Trampa?
```

Esto crea una dinámica interesante: Radar y Brújula son *deducibles por descarte* porque su uso es público y la cantidad inicial se conoce. Pero Pala y Trampa permanecen ambiguas hasta el final.

La gracia no es que todo sea privado. Es que puedes *elegir* qué revelar y qué no.

---

## Cómo funciona (para los curiosos)

Aztec usa un modelo de notas privadas similar a UTXO. Cada tesoro, trampa y poder es una "nota" que solo el dueño puede ver y modificar.

```
contracts/src/
├── main.nr           # Contrato principal
├── treasure_note.nr  # Nota privada: posición de tesoro
├── trap_note.nr      # Nota privada: posición de trampa
├── power_note.nr     # Nota privada: inventario de poderes
└── game.nr           # Estado público del juego
```

Las funciones privadas (`use_shovel`, `use_trap`) generan pruebas ZK en el cliente. Las públicas (`dig`, `create_game`) ejecutan on-chain. El contrato puede verificar que una acción es válida sin saber qué acción es.

---

## Pruébalo

```bash
# Terminal 1: Red local de Aztec
aztec start --local-network

# Terminal 2: Contratos
cd contracts && yarn install
yarn compile && yarn codegen && yarn deploy

# Terminal 3: Cliente
cd client && yarn install && yarn dev
# Abrir http://localhost:3001
```

---

## Construye algo similar

Treasure Hunt demuestra tres capacidades de Aztec:

1. **Estado privado modificable** — mover tesoros sin dejar rastro
2. **Estado privado dinámico** — agregar trampas que no existían al inicio
3. **Acciones indistinguibles** — el oponente no puede diferenciar Pala de Trampa

Si estás construyendo algo donde la privacidad importa (juegos, votaciones, subastas, DeFi), [Aztec](https://aztec.network) te da herramientas que no existen en otras cadenas.

[Documentación](https://docs.aztec.network) · [Noir (lenguaje)](https://noir-lang.org) · [Discord](https://discord.gg/aztec)
