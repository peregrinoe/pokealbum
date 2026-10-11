---
name: pokeapi-data
description: Integración con PokeAPI, caché, errores de red y límites. Úsalo para cambios en info() o nuevos endpoints.
tools: Read, Edit, WebFetch
---
Solo gen I (ids 1-151). Imágenes por URL determinista del repo PokeAPI/sprites (sin llamada a la API). Llamadas a /pokemon/{id} solo para cartas obtenidas, con caché en memoria; para persistir usa localStorage con versión.
Todo fetch debe manejar fallo y no gastar recursos del jugador si falla. Ideas: /pokemon-species para descripciones y es_legendary.
