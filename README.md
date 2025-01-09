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
npm run build:css
cp .env-example .env
npm start
```
## Uso
Una vez el programa se esté ejecutando se puede hacer peticiones http las siguientes rutas:

<table>
    <tr>
        <th>Descripción</th>
        <th>Tipo</th>
        <th>Ruta</th>
        <th>Parámetros</th>
        <th>Respuesta</th>
    </tr>
    <tr>
        <td>Prueba</td>
        <td>GET</td>
        <td>http://localhost:3000/test</td>
        <td></td>
        <td>JSON</td>
    </tr>
    <tr>
        <td>Imprimir</td>
        <td>POST</td>
        <td>http://localhost:3000/print</td>
        <td>Formato JSON descrito abajo de ésta tabla </td>
        <td>JSON</td>
    </tr>
</table>

Formato del cuerpo de la petición para imprimir
```
{
    "templeate" : "", // "", "comanda"
    "company_name": "DesarrolloCreativo",
    "sale_number": "001",
    "payment_type" : "Efectivo",
    "sale_type" : "Mesa",
    "table_number" : 5,
    "discount" : 0,
    "observations" : "Sin aceitunas",
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