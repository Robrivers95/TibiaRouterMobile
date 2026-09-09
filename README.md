# TibiaRouterMobile

PWA mobile-first para controlar una sesión remota del **cliente oficial de Tibia** desde iPhone, Android, iPad o Huawei MatePad.

## MVP publicado

La carpeta `site/` es una PWA estática y contiene:

- joystick virtual de 8 direcciones;
- 4 botones por set con 3 sets iniciales y edición local de icono/nombre/tecla;
- switch rápido entre sets;
- modo Touch directo;
- modo Mouse/trackpad y click derecho con segundo toque;
- drag & drop mediante pointer down/move/up;
- chat con el teclado nativo del teléfono/tablet;
- perfiles Ahorrar datos / Equilibrado / Calidad;
- WebRTC preparado con tres DataChannels;
- signaling WebSocket mínimo en `server/`;
- modo demo para probar la UI sin host;
- instalación como PWA y orientación landscape;
- despliegue automático en GitHub Pages.

La web **no pide ni almacena credenciales de Tibia**. El login debe realizarse dentro del cliente oficial transmitido.

## URL de Pages

Una vez termine el workflow de GitHub Pages:

`https://robrivers95.github.io/TibiaRouterMobile/`

## Arquitectura

```text
PWA iPhone/MatePad
   |  WebRTC video + DataChannels
   v
Windows Host Agent
   |
   v
Cliente oficial Tibia

PWA <---- WebSocket signaling ----> Host Agent
```

## Signaling local

```bash
cd server
npm install
npm start
```

Por defecto escucha en `ws://localhost:8080`.

## Estado del host

El frontend y signaling están implementados. `host/windows-agent/` contiene el contrato del siguiente gate técnico: captura de la ventana de Tibia, H.264/WebRTC e inyección de entradas estándar de Windows. Hasta completar y ejecutar ese agente en un host Windows, la URL pública funciona en **modo demo** y no puede mostrar una sesión real de Tibia.
