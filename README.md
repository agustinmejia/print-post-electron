# Print Post
Software para imprimir en impresoras térmicas ESC/POS desde peticiones HTTP.

## Tecnologías
- Node.js 21
- Electron 33
- Express 4
- escpos / escpos-usb / escpos-network 3.0.0-alpha
- electron-pos-printer (driver Windows nativo)
- Bootstrap 5.3.2

## Requisitos
- Node.js >= 21
- Driver de impresora según modo de conexión (ver sección Configuración)

## Instalación
```bash
npm i
npm start
```

---

## Configuración de conexión

La app soporta tres modos de conexión configurables desde la UI:

| `connectionType` | `usbMode`   | Descripción |
|------------------|-------------|-------------|
| `network`        | —           | TCP/IP. Requiere IP y puerto de la impresora. |
| `usb`            | `windows`   | Driver Windows nativo vía `electron-pos-printer`. No requiere Zadig. |
| `usb`            | `libusb`    | LibUSB vía `escpos-usb`. Requiere Zadig/WinUSB. |

La configuración persiste en disco (`userData/config.json`). Schema:

```json
{
  "connectionType": "network",
  "usbMode": "windows",
  "network": { "ip": "192.168.1.1", "port": 9100 },
  "usb": { "printerName": "EPSON TM-T20", "deviceId": "" },
  "cashDrawer": { "enabled": false, "pin": 2 }
}
```

> **Compatibilidad hacia atrás:** Si la petición HTTP incluye `?ip=...&port=...` como query params, esos valores sobrescriben la config guardada **solo para esa petición**. No persisten en disco.

---

## API HTTP

### Prueba de conexión
`GET http://localhost:3010/test`

Verifica la conexión e imprime una página de prueba.

---

### Imprimir
`POST http://localhost:3010/print`

El campo `template` del body determina qué se imprime. Los campos marcados como *opcional* pueden omitirse o enviarse vacíos.

#### Campo `employee` (opcional)
Disponible en `recibo`, `comanda` y `recibo_tienda`. Si se envía y no está vacío, imprime `Atendido por: <nombre>` a la izquierda de la fecha/hora al pie del comprobante.

---

#### `recibo` — Recibo de restaurante

```json
{
    "template": "recibo",
    "company_name": "Mi Restaurante",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5,
    "customer": "Juan Pérez",
    "payment_type": "Efectivo",
    "discount": 0,
    "font_size": 0,
    "employee": "Carlos",
    "details": [
        { "product": "Pollo económico",      "quantity": 1, "total": 12 },
        { "product": "Hamburguesa completa", "quantity": 2, "total": 24 },
        { "product": "Coca cola 1 lt.",      "quantity": 1, "total": 10 }
    ]
}
```

Opcionales: `sale_type`, `table_number`, `customer`, `payment_type`, `discount`, `font_size`, `employee`.

---

#### `ticket` — Ticket de pedido simple

Ticket reducido con número de venta y mesa, sin items.

```json
{
    "template": "ticket",
    "company_name": "Mi Restaurante",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5
}
```

Opcionales: `table_number`.

---

#### `comanda` — Comanda de cocina

```json
{
    "template": "comanda",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5,
    "customer": "Juan Pérez",
    "observations": "Sin aceitunas",
    "font_size": 0,
    "employee": "Carlos",
    "details": [
        { "product": "Pollo económico",      "quantity": 1, "total": 12 },
        { "product": "Hamburguesa completa", "quantity": 2, "total": 24 }
    ]
}
```

Opcionales: `sale_type`, `table_number`, `customer`, `observations`, `font_size`, `employee`.

---

#### `ticket_comanda` — Ticket + comanda

Imprime primero el ticket simple y luego la comanda. Acepta los mismos campos que `comanda` más `company_name`.

```json
{
    "template": "ticket_comanda",
    "company_name": "Mi Restaurante",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5,
    "customer": "Juan Pérez",
    "observations": "Sin aceitunas",
    "employee": "Carlos",
    "details": [
        { "product": "Pollo económico", "quantity": 1, "total": 12 }
    ]
}
```

---

#### `recibo_tienda` — Recibo para tienda o farmacia

Recibo con precio unitario por ítem. Apto para comercios y farmacias.

```json
{
    "template": "recibo_tienda",
    "company_name": "Farmacia Central",
    "sale_number": "001",
    "customer": "Juan Pérez",
    "payment_type": "Efectivo",
    "discount": 1.00,
    "tax": 1.08,
    "font_size": 0,
    "employee": "Ana",
    "details": [
        { "product": "Paracetamol 500mg", "quantity": 2, "unit_price": 5.00, "total": 10.00 },
        { "product": "Ibuprofeno 400mg",  "quantity": 1, "unit_price": 3.50, "total": 3.50  }
    ]
}
```

Opcionales: `customer`, `payment_type`, `discount`, `tax`, `font_size`, `employee`.

---

#### `cierre_caja` — Cierre de caja

Resumen de cierre con arqueo, inventario de productos, ventas por producto y cortes de billetes.

```json
{
    "template": "cierre_caja",
    "user": "Admin",
    "date": "15/05/2026",
    "opening_amount": 500.00,
    "income_amount": 1200.00,
    "expenses_amount": 150.00,
    "closed_amount": 1550.00,
    "missing_amount": 0.00,
    "surplus_amount": 0.00,
    "qr_amount": 200.00,
    "total_sales_amount": 1200.00,
    "products": [
        { "name": "Pollo económico",  "opening": 20, "closed": 10 },
        { "name": "Hamburguesa",      "opening": 15, "closed": 8  }
    ],
    "sales": [
        { "product": "Pollo económico",  "quantity": "10", "total": "120.00" },
        { "product": "Hamburguesa",       "quantity": "7",  "total": "84.00"  }
    ],
    "money": [
        { "amount": "Bs. 200", "quantity": "3" },
        { "amount": "Bs. 100", "quantity": "5" }
    ]
}
```

Opcionales: `products`, `sales`, `money`. Si se omiten, esas secciones no se imprimen.

---

#### `inventario` — Inventario

```json
{
    "template": "inventario",
    "user": "Admin",
    "branch": "Sucursal Central",
    "products": [
        { "name": "Paracetamol 500mg", "stock": 120 },
        { "name": "Ibuprofeno 400mg",  "stock": 45  }
    ]
}
```

Opcionales: `user`, `branch`.

---

#### Sin template / valor desconocido

Si `template` no se envía o no coincide, imprime recibo + comanda juntos. Equivalente a `recibo` seguido de `comanda`.

---

## Generar ejecutable
```bash
npm run make
```

---

## Problemas frecuentes

### Bug en escpos-usb `3.0.0-alpha.4`
Reemplazar la línea 52 de `node_modules\escpos-usb\index.js`:
```
usb.usb.on('detach', function(device){
```

### Driver incompatible (modo LibUSB)
1. Descarga [Zadig](https://zadig.akeo.ie/).
2. Conecta la impresora USB.
3. Abre Zadig → **Options > List All Devices**.
4. Selecciona tu impresora.
5. En desplegable de controladores elige **libusb-win32** o **WinUSB**.
6. Clic en **Replace Driver**.

> Para evitar esto, usar modo `usb` + `usbMode: "windows"` que no requiere Zadig.
