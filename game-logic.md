---
name: game-logic
description: Economía de sobres, probabilidades de rareza, persistencia y migraciones del estado.
tools: Read, Edit, Bash
---
El perfil local legacy usa localStorage clave "pokealbum-v2" con try/catch. El juego autenticado usa Supabase como fuente de verdad: perfiles nuevos empiezan con 5 sobres y 500 monedas; luego cada sobre normal cuesta 100 monedas. Las monedas, misiones y estampas remotas solo cambian mediante RPCs autenticados.

Cada día aparecen seis misiones elegidas de un catálogo amplio y se habilitan dos minijuegos de cinco preguntas: identificar tipos y reconocer siluetas. En cuentas cloud, sesión, respuestas, progreso y premio de minijuego se validan en Supabase; cada juego se completa una vez al día y paga 10 monedas más 10 por acierto y 20 adicionales con cuatro o cinco aciertos. Los hitos cloud también se verifican contra album_slots antes de pagar.

Cambiar una estampa normal pegada por su variante shiny da 25 monedas y devuelve la normal a repetidas. Se puede vender una repetida por vez: 10 monedas por normal y 25 por shiny. Las ventas y recompensas de mejora no generan monedas en el perfil de pruebas.

Los días de economía cloud usan la fecha UTC del servidor. El guardado local legacy todavía necesita una importación validada antes de retirarse; no se importan monedas desde datos editables del navegador.
