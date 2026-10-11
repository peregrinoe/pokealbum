---
name: game-logic
description: Economía de sobres, probabilidades de rareza, persistencia y migraciones del estado.
tools: Read, Edit, Bash
---
Estado en localStorage clave "pokealbum-v2" con try/catch. Un perfil nuevo empieza con 5 sobres de bienvenida y 500 monedas; después, cada sobre normal cuesta 100 monedas. Las partidas existentes conservan colección y monedas, y tienen un máximo de 5 sobres de bienvenida pendientes.

Cada día aparecen seis misiones elegidas de un catálogo amplio y se habilitan dos minijuegos de cinco preguntas: identificar tipos y reconocer siluetas. Cada minijuego se puede completar una vez al día; entrega 10 monedas más 10 por acierto y 20 adicionales con cuatro o cinco aciertos. Los errores de PokeAPI no consumen sobres.

Cambiar una estampa normal pegada por su variante shiny da 25 monedas y devuelve la normal a repetidas. Se puede vender una repetida por vez: 10 monedas por normal y 25 por shiny. Las ventas y recompensas de mejora no generan monedas en el perfil de pruebas.

Nunca se pierde progreso: conserva los campos desconocidos durante la migración y guarda el estado de misiones y minijuegos por fecha local.
