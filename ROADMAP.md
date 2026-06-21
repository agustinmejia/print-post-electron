# Roadmap — Refactor Multi-Conexión v1.2.0

## Objetivo
Soportar múltiples métodos de conexión (USB Windows driver, USB LibUSB, Red TCP/IP) y agregar soporte de cajón de dinero con configuración persistente.

## Estado actual (v1.1.0)
- Config: solo query params HTTP (`?ip=...&port=...`), sin persistencia en disco
- USB: `escpos.USB()` — primera impresora encontrada, sin selección
- Red: `escpos.Network(ip, port)` — funcional
- UI: solo botones de prueba, sin panel de configuración
- IPC: preload.js vacío, sin handlers en main.js
- Cajón: no implementado

---

## Fase 1 — Instalar dependencia nueva

- [x] **1.1** Ejecutar `npm install electron-pos-printer`
- [x] **1.2** Verificar compatibilidad con Electron 33 — `electron-pos-printer@1.4.0` es puro JS (deps: `jsbarcode`, `qrcode`), sin módulos nativos. Compatible con cualquier versión de Electron.
- [x] **1.3** Verificar forge.config.js — `@electron-forge/plugin-auto-unpack-natives` presente. Sin módulos nativos en esta lib no hay problema. **Nota:** `build.extraResources` en forge.config.js es sintaxis de electron-builder (incorrecta). Corregir en Fase 7 a `packagerConfig.extraResource`.

---

## Fase 2 — Persistencia de configuración (IPC)

Archivos: `main.js`, `preload.js`

- [x] **2.1** Definir esquema de config con valores por defecto — `DEFAULT_CONFIG` en `main.js`
- [x] **2.2** Implementar lectura/escritura en `main.js` — `loadConfig()` / `saveConfig()` con `app.getPath('userData')/config.json`
- [x] **2.3** Handler IPC `config:get` — devuelve `appConfig` actual
- [x] **2.4** Handler IPC `config:set` — `deepMerge()` + guarda a disco, retorna config resultante
- [x] **2.5** Handler IPC `printers:list` — `mainWindow.webContents.getPrintersAsync()`, retorna `[{name, isDefault}]`
- [x] **2.6** `preload.js` actualizado con `contextBridge`: `window.api.getConfig()`, `window.api.setConfig()`, `window.api.getPrinters()`
- [x] **2.7** Config carga al arrancar (`loadConfig()` en module scope). Si no existe archivo, se crea con defaults al primer `saveConfig()`.
- [ ] **2.8** Compatibilidad hacia atrás: si request HTTP llega con `?ip=...`, ese valor sobrescribe config de disco **solo para esa petición** (no persiste) — implementar en Fase 3 al modificar `server.js`

---

## Fase 3 — Abstracción de impresión

Archivo nuevo: `printer-adapter.js` (en raíz del proyecto)

- [x] **3.1** Crear función `getPrinter(config)` en `printer-adapter.js` — factory retorna adapter según `connectionType` + `usbMode`
- [x] **3.2** Interfaz común: `adapter.print(printCommandsFn)`. Cajón integrado en cada adapter, no como método separado.
- [x] **3.3** `NetworkAdapter` — usa `escpos.Network`, lógica migrada desde `getDevice` + `printWithDevice`
- [x] **3.4** `LibUsbAdapter` — usa `escpos.USB()` (primera encontrada)
- [x] **3.5** `WindowsDriverAdapter` — `BufferDevice` acumula bytes ESC/POS → `PosPrinter.sendRawCommand()`. Sin conversión de formato: reutiliza escpos API directamente.
- [x] **3.6** `server.js` refactorizado: `getDevice` + `printWithDevice` eliminados. Todas las templates y `/test` usan `getPrinter(getRequestConfig(printerConfig)).print()`. Lógica de templates intacta.
- [x] **2.8 / 3.6** Compat. hacia atrás implementada en `getRequestConfig()`: `?ip=...` en query sobrescribe config de disco solo para esa petición.
- [ ] **3.7** Verificar que `printer-adapter.js` se incluye en el build — revisar en Fase 7

---

## Fase 4 — Cajón de dinero

Archivo: `printer-adapter.js`, `server.js`

- [x] **4.1** `NetworkAdapter` y `LibUsbAdapter`: `printer.cashdraw(pin)` se llama en `printEscPos()` si `cashDrawer.enabled === true`
- [x] **4.2** Llamada a `cashdraw` envuelta en try/catch — error loggea con `console.error`, no interrumpe
- [x] **4.3** `WindowsDriverAdapter`: cajón vía `PosPrinter.openCashDrawer(printerName, {pin})` — ESC/POS bytes por raw command. No es no-op: funciona nativamente.
- [ ] **4.4** Validar pin en `config:set` handler — implementar al construir UI (Fase 6)

---

## Fase 5 — Enumeración de dispositivos USB LibUSB (condicional)

Archivo: `server.js` o nuevo `usb-utils.js`

- [x] **5.1** `escpos-usb` expone `USB.findPrinter()` — devuelve array de device objects USB (filtrados por `bInterfaceClass === 0x07 PRINTER`)
- [x] **5.2** Handler IPC `usb:list` en `main.js` → `[{vendorId, productId, deviceId: "vid:pid", label}]`. Envuelto en try/catch — devuelve `[]` si WinUSB no instalado.
- [x] **5.3** `LibUsbAdapter` usa `config.usb.deviceId` (`"vid:pid"`) si está seteado → `new escpos.USB(vid, pid)`. Fallback a `escpos.USB()` si vacío.
- [x] **5.4** N/A — enum múltiple implementado. `window.api.getUsbDevices()` expuesto en preload.

---

## Fase 6 — UI de configuración

Archivo: `pages/index.html`

- [x] **6.1** Botón engranaje `<i class="bi bi-gear">` en header → abre modal Bootstrap
- [x] **6.2** `openSettings()` carga config con `window.api.getConfig()` antes de abrir modal
- [x] **6.3** Radios `[○ USB] [○ Red (TCP/IP)]` con listener `handleConnectionTypeChange()`
- [x] **6.4** Sección Red: campos IP y Puerto, visibles solo con `connectionType === "network"`
- [x] **6.5** Sección USB: radios `[○ Driver Windows (Recomendado)] [○ LibUSB]` con listener `handleUsbModeChange()`
- [x] **6.6** Sub-sección Windows: dropdown `win-printer` + botón refresh → `window.api.getPrinters()`
- [x] **6.7** Sub-sección LibUSB: dropdown `usb-device` + botón refresh → `window.api.getUsbDevices()`. Sin dispositivos: muestra opción "automático" + aviso Zadig.
- [x] **6.8** Cajón: checkbox enable + radios pin 2/5, con `drawer-pin-section` condicional
- [x] **6.9** Textos de ayuda por modo (Red / Windows / LibUSB) con iconos Bootstrap
- [x] **6.10** `saveSettings()` valida, llama `window.api.setConfig()`, muestra feedback, cierra modal en 800ms
- [x] **6.11** Botones de prueba usan `http://127.0.0.1:3010/print` sin query params — server lee config de disco
- [x] Badge de modo activo en pantalla principal (actualiza tras guardar y al cargar la app)

---

## Fase 7 — Actualizar forge.config.js y empaquetado

Archivo: `forge.config.js`

- [x] **7.1** `printer-adapter.js` en raíz del proyecto → incluido en asar por defecto (forge incluye todos los archivos del proyecto). No requiere `extraResources`.
- [x] **7.2** `electron-pos-printer@1.4.0` — puro JS (sin módulos nativos). No requiere desempaquetado. `escpos-usb` usa `usb` nativo → cubierto por `@electron-forge/plugin-auto-unpack-natives`.
- [x] **7.3** Corregidas claves inválidas en forge.config.js: eliminados `build.extraResources` (sintaxis electron-builder) y `files: []` (clave raíz inválida). Agregado `packagerConfig.ignore` para excluir artefactos dev. Build pendiente de prueba manual.
- [ ] **7.4** _(pendiente)_ Ejecutar `npm run make` y probar instalador generado

---

## Criterios de aceptación

- [x] Flujo de red existente (`?ip=...&port=...`) no se rompe — `getRequestConfig()` detecta `?ip=` y sobrescribe config solo para esa petición
- [x] Flujo USB LibUSB existente no se rompe — `LibUsbAdapter` mantiene comportamiento con fallback a primera impresora encontrada
- [x] Nuevo flujo Windows driver implementado — `WindowsDriverAdapter` + `PosPrinter.sendRawCommand()`
- [x] Config persiste entre reinicios — JSON en `app.getPath('userData')/config.json`
- [x] Cajón en ESC/POS — `printer.cashdraw(pin)` con try/catch. Error no cancela impresión.
- [x] Cajón en Windows driver — `PosPrinter.openCashDrawer(printerName, {pin})`
- [x] UI muestra ayudas visuales por modo (textos + iconos Bootstrap en modal)
- [ ] Build con `electron-forge make` genera instalador funcional — pendiente prueba manual

---

## Orden de ejecución recomendado

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7
```

## Archivos que NO se tocan (regla)
- Funciones de template: `printRecipe`, `printTicket`, `printComanda`, `printCloseBox`, `printInventory`, `printStoreReceipt`
- Lógica de routing Express (`app.post('/print', ...)`)
- Comportamiento del tray y ventana principal (`main.js` — solo se agregan handlers IPC)
