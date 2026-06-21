# CLAUDE.md — print-post-electron

Contexto del proyecto para asistente de IA.

---

## Qué es este proyecto

App Electron que actúa como **servicio local de impresión térmica**. Corre un servidor Express en puerto `3010` y expone endpoints HTTP. Sistemas externos (ej: PanaderiApp, restaurantes) hacen `POST /print` para imprimir tickets, comandas, recibos, etc.

- **No es una app de usuario final** — vive en la bandeja del sistema.
- La UI (`pages/index.html`) es solo para pruebas y configuración.
- Clientes externos consumen la API HTTP.

---

## Estructura de archivos

```
main.js              — Proceso principal Electron. Crea ventana, tray, inicia server.
preload.js           — Bridge IPC (actualmente mínimo).
server.js            — Servidor Express + toda la lógica de impresión ESC/POS.
pages/index.html     — UI: botones de prueba, panel de configuración (en desarrollo).
forge.config.js      — Config de empaquetado con electron-forge.
assets/              — Iconos e imágenes.
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron 33 |
| Servidor HTTP | Express 4 |
| UI | Bootstrap 5.3.2, JavaScript vanilla |
| Impresión ESC/POS | escpos@3.0.0-alpha.6 |
| Driver red | escpos-network@3.0.0-alpha.5 |
| Driver USB | escpos-usb@3.0.0-alpha.4 |
| Build | electron-forge 7.6.0 |

---

## Flujo actual de impresión

```
POST http://127.0.0.1:3010/print?ip=<IP>&port=<PUERTO>
  Body: { template: "recibo", ...data }
    ↓
server.js → switch(template) → printRecipe/printTicket/...
    ↓
getDevice(req.query) → escpos.USB() | escpos.Network(ip, port)
    ↓
printWithDevice(device, fn) → device.open() → printer commands → cut() → close()
```

**Config actual**: solo query params HTTP por petición. **Sin persistencia en disco.**

---

## Templates de impresión disponibles

| Template | Función | Descripción |
|----------|---------|-------------|
| `recibo` | `printRecipe()` | Recibo de restaurante |
| `ticket` | `printTicket()` | Ticket de orden |
| `comanda` | `printComanda()` | Comanda de cocina |
| `ticket_comanda` | combo | Ticket + comanda (dos impresiones) |
| `cierre_caja` | `printCloseBox()` | Cierre de caja con desglose |
| `inventario` | `printInventory()` | Lista de stock |
| `recibo_tienda` | `printStoreReceipt()` | Recibo farmacia/retail |

---

## Actualización en curso: v1.2.0 — Multi-conexión

Ver `ROADMAP.md` para tareas detalladas.

### Qué se está haciendo

Refactor para soportar:
1. **USB + Driver Windows** — `electron-pos-printer` (nuevo), usa impresoras instaladas en Windows, sin Zadig
2. **USB + LibUSB** — comportamiento actual con `escpos-usb`, requiere Zadig/WinUSB
3. **Red TCP/IP** — comportamiento actual con `escpos-network`

### Nueva estructura de config (schema v1.2)

```json
{
  "connectionType": "network",
  "usbMode": "windows",
  "network": { "ip": "", "port": 9100 },
  "usb": { "printerName": "", "deviceId": "" },
  "cashDrawer": { "enabled": false, "pin": 2 }
}
```

Config persiste en disco via IPC. Ruta: `app.getPath('userData')/config.json`.

### Archivos nuevos que se crearán

- `printer-adapter.js` — abstracción de drivers de impresión
- `config.json` (en userData) — configuración persistente

### Archivos que se modifican

- `main.js` — agregar handlers IPC (`config:get`, `config:set`, `printers:list`)
- `preload.js` — exponer `window.api` con getConfig/setConfig/getPrinters
- `server.js` — reemplazar `getDevice()` + `printWithDevice()` con adapter
- `pages/index.html` — agregar panel de configuración
- `forge.config.js` — asegurar empaquetado correcto

### Regla crítica: NO tocar

Las funciones de template (`printRecipe`, `printTicket`, `printComanda`, `printCloseBox`, `printInventory`, `printStoreReceipt`) **no se modifican**. El adapter debe ser transparente para ellas.

---

## Compatibilidad hacia atrás

Si un cliente externo envía `?ip=...&port=...` en la request:
- Esos valores sobrescriben config de disco **solo para esa petición**
- No persisten
- El flujo de red existente no se rompe

---

## Notas de desarrollo

- `electron-reload` está comentado en `main.js` — descomentar para hot reload en desarrollo
- `mainWindow.webContents.openDevTools()` está comentado — descomentar para debuggear renderer
- CORS configurado con `origin: '*'` — aceptable para servicio local
- App usa `app.requestSingleInstanceLock()` — solo corre una instancia
- Al cerrar ventana: se oculta (no cierra). Solo cierra desde menú de tray.
- Codepage de impresión: `CP850` (soporta caracteres latinos/españoles)

---

## Comandos útiles

```bash
npm start          # Iniciar en desarrollo
npm run make       # Build instalador Windows (Squirrel)
npm run package    # Solo empaquetar sin instalador
```
