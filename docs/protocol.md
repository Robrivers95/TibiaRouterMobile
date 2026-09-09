# Protocolo de control

## inputReliable

```json
{"type":"direction","direction":"NE","active":true}
{"type":"action","key":"F1","actionId":"heal"}
{"type":"pointer","phase":"down","x":0.45,"y":0.62,"button":0}
{"type":"pointer","phase":"up","x":0.45,"y":0.62,"button":0}
{"type":"mouseClick","button":2}
{"type":"quality","profile":"data","width":1280,"height":720,"fps":30,"bitrateKbps":1500}
```

## inputRealtime

```json
{"type":"pointer","phase":"move","x":0.46,"y":0.62}
{"type":"pointerDelta","dx":8,"dy":-2}
```

## textInput

```json
{"type":"chat","text":"Hi, wanna hunt?"}
```

Las coordenadas absolutas son normalizadas (0..1) para que funcionen en iPhone, tablet y escritorio independientemente de la resolución del host.
