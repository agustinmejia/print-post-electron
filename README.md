# Print Post
Software para imprimir en impresoras térmicas ESC/POS desde peticiones HTTP.

## Tecnologías
- Nodejs 21
- electron 33
- express 4
- escpos / escpos-usb 3

## Requisitos
- Nodejs >= 21
- Driver y configuración de la impresora POS

## Instalación
```bash
npm i
npm start
```

## Uso

> **IMPORTANTE:** Si la impresora está en red, agregar `ip` y `port` (opcional) como query params:
> `?ip=192.168.1.1&port=9100`

### Prueba de conexión `GET http://localhost:3010/test`
Verifica la conexión e imprime una página de prueba.

---

### Imprimir `POST http://localhost:3010/print`

El campo `template` del body determina qué se imprime. Todos los campos marcados como *opcional* pueden omitirse.

---

#### `recibo` — Recibo de restaurante
Imprime recibo completo con items, totales y datos del pedido.

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
    "details": [
        { "product": "Pollo económico",      "quantity": 1, "total": 12 },
        { "product": "Hamburguesa completa", "quantity": 2, "total": 24 },
        { "product": "Coca cola 1 lt.",      "quantity": 1, "total": 10 }
    ]
}
```
`sale_type`, `table_number`, `customer`, `payment_type`, `discount`, `font_size` son opcionales.

---

#### `ticket` — Ticket de pedido simple
Imprime un ticket reducido solo con el número de venta y mesa (sin items).

```json
{
    "template": "ticket",
    "company_name": "Mi Restaurante",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5
}
```
`table_number` es opcional.

---

#### `comanda` — Comanda de cocina
Imprime la comanda para cocina con los items del pedido.

```json
{
    "template": "comanda",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5,
    "customer": "Juan Pérez",
    "observations": "Sin aceitunas",
    "font_size": 0,
    "details": [
        { "product": "Pollo económico",      "quantity": 1, "total": 12 },
        { "product": "Hamburguesa completa", "quantity": 2, "total": 24 }
    ]
}
```
`sale_type`, `table_number`, `customer`, `observations`, `font_size` son opcionales.

---

#### `ticket_comanda` — Ticket + comanda
Imprime primero el ticket simple y luego la comanda de cocina. Acepta los mismos campos que `comanda`.

```json
{
    "template": "ticket_comanda",
    "company_name": "Mi Restaurante",
    "sale_number": "001",
    "sale_type": "Mesa",
    "table_number": 5,
    "customer": "Juan Pérez",
    "observations": "Sin aceitunas",
    "details": [
        { "product": "Pollo económico", "quantity": 1, "total": 12 }
    ]
}
```

---

#### `recibo_tienda` — Recibo para tienda o farmacia
Imprime recibo con precio unitario por ítem. Apto para comercios y farmacias.

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
    "details": [
        { "product": "Paracetamol 500mg", "quantity": 2, "unit_price": 5.00, "total": 10.00 },
        { "product": "Ibuprofeno 400mg",  "quantity": 1, "unit_price": 3.50, "total": 3.50  }
    ]
}
```
`customer`, `payment_type`, `discount`, `tax`, `font_size` son opcionales.

---

#### `cierre_caja` — Cierre de caja
Imprime el resumen de cierre de caja con ventas, cortes de billetes y arqueo.

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
        { "name": "Pollo económico", "quantity": 10 }
    ],
    "sales": [
        { "payment_type": "Efectivo", "amount": 1000.00 },
        { "payment_type": "QR",       "amount": 200.00  }
    ],
    "money": [
        { "amount": "Bs. 200", "quantity": 3 },
        { "amount": "Bs. 100", "quantity": 5 }
    ]
}
```
`products`, `sales` y `money` son opcionales.

---

#### `inventario` — Inventario
Imprime el listado de productos con su stock actual.

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
`user` y `branch` son opcionales.

---

#### Sin template / valor desconocido — Recibo + comanda (restaurante)
Si `template` no se envía o no coincide con ninguno de los anteriores, imprime el recibo y la comanda juntos. Equivalente a enviar `template: "recibo"` seguido de `template: "comanda"`.

---

## Generar ejecutable
```bash
npm run make
```

## Problemas frecuentes

### Bug en la librería escpos-usb `3.0.0-alpha.4`
Reemplazar la línea 52 del archivo `node_modules\escpos-usb\index.js`:
```
usb.usb.on('detach', function(device){
```

### Driver incompatible
1. Descarga [Zadig](https://zadig.akeo.ie/) desde su página oficial.
2. Conecta la impresora USB a tu computadora.
3. Abre Zadig y selecciona **Options > List All Devices**.
4. Busca tu impresora en la lista (ej. "USB Printer").
5. En el desplegable de controladores, selecciona **libusb-win32** o **WinUSB**.
6. Haz clic en **Replace Driver**.
