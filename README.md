<h1 align="center">Aztec - Treasure Hunt </h1>

<p align="center">
  <img src="img/game.png" width="80%" />
</p>

Treasure Hunt es un juego desarrollado en la red de Aztec, donde el objetivo del juego es encontrar los tesoros escondidos del oponente.

En Aztec tenemos la ventaja de poder tener estados privados y acciones privadas, lo que permite crear juegos mas complejos y divertidos.

Tu oponente acaba de hacer algo. No sabes qué. ¿Movió su tesoro a otra casilla? ¿Puso una trampa donde planeas cavar? No hay forma de saberlo. Solo sabes que *algo* cambió.

Esa incertidumbre genuina no existe en ningún otro juego on-chain.

---

## El problema con los juegos que tienen privacidad en blockchain

Los juegos con privacidad en blockchain tienen dos opciones, ambas malas:

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
| **Radar** | Escanea un área 3x3, revela cuántos tesoros hay pero no su posicion |
| **Brújula** | Da la distancia al tesoro más cercano |
| **Pala Dorada** | Mueve uno de tus tesoros a otra casilla |
| **Trampa** | Si el oponente cava ahí, pierde su turno |

Radar y Brújula son públicos: cuando los usas, tu oponente lo sabe.

Pala Dorada y Trampa son invisibles: tu oponente solo ve que "pasaste el turno".

Cuando tu oponente hace una acción invisible, no sabes si movió su tesoro o puso una trampa. Ambas lucen exactamente igual desde afuera.

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

Cada acción invisible agrega incertidumbre. ¿El tesoro sigue donde estaba? ¿Hay trampas esperándote? La información es genuinamente privada, no solo oculta temporalmente.

---

## Por qué esto no funciona con commit-reveal

Con commit-reveal, publicas `hash(posiciones + salt)` al inicio. El estado queda grabado en piedra.

| Lo que quieres hacer | Commit-reveal | Aztec |
|---------------------|---------------|-------|
| Mover tesoros después de empezar | Necesitas re-commit (visible, te delata) | Cambio invisible |
| Poner trampas durante la partida | Imposible, no estaban en el commit original | Sin problema |
| Acciones indistinguibles | Cada tipo de acción deja huella diferente | Pala y Trampa lucen igual |

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

---

## Pruébalo

### Prerequisites

```bash
# Docker installed

# Aztec CLI installed:
bash -i <(curl -s https://install.aztec.network)

# The devnet version installed:
aztec-up 3.0.0-devnet.20251212
```

### Game

```bash
# Terminal 1: Start the local network
aztec start --local-network

# Terminal 2: Contratos
cd contracts && yarn install
yarn compile && yarn codegen && yarn deploy

# Terminal 3: Cliente
cd client && yarn install && yarn dev
# Abrir http://localhost:3001
```

---
