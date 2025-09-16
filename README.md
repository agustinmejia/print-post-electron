# Print Post
Software para imprimir en impresoras térmicas ESC/POS desde peticiones HTTP.

## Tecnologías
- Nodejs 21
- electron 33
- express 4
- escpos escpos-usb 3

## Requesitos
- Nodejs >= 21
- Driver y configuración de la impresora POS

## Instalación
```bash
npm i
npm start
```
## Uso
### Impresión de prueba ```GET http://localhost:3010/test```
Devuelve los datos de la impresora y hace una impresión de prueba

### Impresión de ticket ```POST http://localhost:3010/print```

> **IMPORTANTE:** En el caso de que que la impresora esté en red se debe enviar en la petición la ```ip``` y el ```puerto``` (opcional) de la impresora ```?ip=192.168.1.1&port=```

Cuerpo de la petición:

```json
{
    "template" : "normal",
    "company_name": "DesarrolloCreativo",
    "sale_number": "001",
    "payment_type" : "Efectivo",
    "sale_type" : "Mesa",
    "table_number" : 5,
    "discount" : 0,
    "observations" : "Sin aceitunas",
    "customer" : "Juan Perez",
    "details" : [
        {
            "product" : "Pollo económico",
            "quantity" : 1,
            "total" : 12
        },
        {
            "product" : "Hamburguesa completa",
            "quantity" : 2,
            "total" : 24
        },
        {
            "product" : "Coca cola 1 lt.",
            "quantity" : 1,
            "total" : 10
        }
    ]
}
```
> **NOTA:** ***template: 'normal'*** imprime el ticket y la comanda, si solo se desea imprimir la comanda se debe escribir "***comanda***".

## Generar ejecutable
```bash
npm run make
```

## Problemas frecuentes
### Bug en la librería escpos-usb ```3.0.0-alpha.4```
Reemplazar la línea 52 del archivo ***node_modules\escpos-usb\index.js***
```
usb.usb.on('detach', function(device){
```

### Driver incompatible
1. Descarga [Zadig](https://zadig.akeo.ie/) desde su página oficial.
2. Conecta la impresora USB a tu computadora.
3. Abre Zadig y selecciona Options > List All Devices.
4. Busca tu impresora en la lista de dispositivos (por ejemplo, algo como "USB Printer").
5. En el desplegable de controladores, selecciona libusb-win32 o WinUSB.
6. Haz clic en Replace Driver para instalarlo.