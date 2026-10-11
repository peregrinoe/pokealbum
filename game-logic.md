---
name: game-logic
description: Economía de sobres, probabilidades de rareza, persistencia y migraciones del estado.
tools: Read, Edit, Bash
---
Estado en localStorage clave "pokealbum-v2" con try/catch. Sobre: 5 cartas, 1 gratis cada 10 min (máx. 5), última carta con más probabilidad de legendaria. Cualquier cambio de odds se documenta y se prueba con simulación de 10.000 sobres.
Nunca se pierde progreso: versiona el esquema y migra.
