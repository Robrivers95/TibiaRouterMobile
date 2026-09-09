# Windows Host Agent

Este componente será el puente entre la PWA y el cliente oficial de Tibia en un host Windows remoto.

## Contrato MVP

1. Conectarse al signaling WebSocket con `role: "host"` y un `sessionId`.
2. Recibir la oferta WebRTC del navegador y devolver `answer` + candidatos ICE.
3. Publicar video de la ventana del cliente oficial, inicialmente H.264/30 FPS.
4. Recibir DataChannels:
   - `inputRealtime`: joystick/puntero continuo.
   - `inputReliable`: clicks, teclas, sets y perfil de calidad.
   - `textInput`: texto escrito con el teclado nativo móvil.
5. Traducir esos eventos a entrada normal de Windows.

## Restricciones de diseño

- No leer memoria del cliente.
- No alterar archivos del cliente.
- No implementar macros, pathfinding, bots ni automatización.
- Una pulsación del usuario equivale a una acción de entrada.

La PWA publicada funciona ya en modo demo; para jugar una sesión real este agente debe estar ejecutándose en un host Windows compatible con el cliente oficial y BattlEye.
