const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

const app = express();
const port = 3010;

// --- Mejoras de Seguridad y Configuración ---
const corsOptions = {
    // EN PRODUCCIÓN: Reemplazar '*' con los dominios permitidos para mayor seguridad.
    // Ejemplo: origin: ['http://mi-frontend.com', 'https://mi-otro-frontend.com']
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
};

// Middleware para manejar JSON
app.use(express.json());
app.use(cors(corsOptions));

// Ruta para imprimir ticket
app.get('/', (req, res) => {
    console.log('Servicio activo')
    res.send({success: 1, message: 'Servicio activo'});
})

app.get('/test', async (req, res) => {
    try {
        console.log('Iniciando prueba de conexión y de impresión...');
        const device = getDevice(req.query);
        let printSuccess = false;
        
        await printWithDevice(device, (printer) => {
            printer
                .size(1, 1)
                .align('ct').style('NORMAL')
                .text(`Impresión de prueba`)
                .size(0, 0)
                .text('desarrollocreativo.dev')
                .cut();
        });

        printSuccess = true;
        console.log('Prueba de conexión e impresión finalizada correctamente.');
        res.status(200).send({
            success: 1,
            message: 'Prueba de impresión enviada correctamente.',
            details: {
                print: printSuccess
            }
        });
    } catch (error) {
        console.error('Error en la ruta /test:', error.message);
        res.status(500).send({ success: 0, message: error.message });
    }
});

app.post('/print', async (req, res) => {
    try {
        const { template, ...data } = req.body;
        const printerConfig = req.query;

        console.log(`Recibida solicitud para template: ${template ? template : 'no definida'}`);

        switch (template) {
            case 'recibo':
                await printRecipe(data, printerConfig);
                break;
            case 'ticket':
                await printTicket(data, printerConfig);
                break;
            case 'comanda':
                await printComanda(data, printerConfig);
                break;
            case 'ticket_comanda':
                await printTicket(data, printerConfig);
                await printComanda(data, printerConfig);
                break;
            case 'cierre_caja':
                await printCloseBox(data, printerConfig);
                break;
            default:
                await printRecipe(data, printerConfig);
                await printComanda(data, printerConfig);
                break;
        }

        console.log('Ticket impreso correctamente.');
        res.status(200).send({ success: 1, message: 'Ticket impreso correctamente' });
    } catch (error) {
        console.error('Error en la ruta /print:', error.message);
        res.status(500).send({ success: 0, message: `Error al imprimir: ${error.message}` });
    }
});

// --- Funciones de Utilidad ---

/**
 * Obtiene el dispositivo de impresión (USB o Red) según la configuración.
 * @param {object} config - Objeto con `ip` y `port`.
 * @returns {escpos.USB|escpos.Network}
 */
function getDevice(config) {
    const { ip, port } = config;
    if (ip) {
        console.log(`Conectando a impresora de red en ${ip}:${port || 9100}`);
        return new escpos.Network(ip, port || 9100);
    }
    console.log('Conectando a impresora USB.');
    return new escpos.USB();
}

/**
 * Envuelve la lógica de impresión en una Promesa para un manejo asíncrono.
 * @param {escpos.USB|escpos.Network} device - El dispositivo de impresión.
 * @param {function(escpos.Printer): void} printCommands - Función que ejecuta los comandos de impresión.
 * @returns {Promise<void>}
 */
function printWithDevice(device, printCommands) {
    return new Promise((resolve, reject) => {
        try {
            const printer = new escpos.Printer(device, { encoding: "CP850" });
            device.open((error) => {
                if (error) {
                    return reject(new Error(`Error al abrir la impresora: ${error.message}`));
                }
                try {
                    printCommands(printer);
                    printer.close();
                    resolve();
                } catch (printError) {
                    reject(new Error(`Error durante la impresión: ${printError.message}`));
                }
            });
        } catch (deviceError) {
            reject(new Error(`Error al inicializar el dispositivo: ${deviceError.message}`));
        }
    });
}

// --- Lógica de Plantillas de Impresión ---

async function printRecipe(data, printerConfig) {
    const { company_name, sale_number, payment_type, sale_type, table_number, discount, customer, details, font_size: raw_font_size } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!sale_number || !details){
        console.log('Formato de datos incorrecto')
        return;
    }

    const fontSize = !isNaN(raw_font_size) ? parseInt(raw_font_size) : 0;
    const device = getDevice(printerConfig);

    await printWithDevice(device, (printer) => {
        printer
            .align('ct').style('B').size(0, 0 + fontSize).text(company_name)
            .size(0, 0 + fontSize)
            .align('ct').style('B')
            .text(`Ticket ${sale_number}`)
            .text(`${sale_type}${table_number ? ' ' + table_number : ''}`)
            .style('NORMAL')
            .align('lt')
            .tableCustom([
                { text: 'Nombre:', align: 'LEFT' },
                { text: customer || 'Sin nombre', align: 'RIGHT' }
            ])
            .size(0, 0)
            .drawLine()
            .size(0, 0 + fontSize)
            .align('lt');

        let total = 0;
        (details || []).forEach(item => {
            printer.tableCustom([
                { text: item.quantity, align: 'LEFT', width: 0.10 },
                { text: item.product, align: 'LEFT', width: 0.56 },
                { text: item.total.toFixed(2), align: 'RIGHT', width: 0.33 }
            ]);
            total += parseFloat(item.total);
        });

        printer.size(0, 0).drawLine().size(0, 0 + fontSize);

        if (discount) {
            printer.align('rt').style('B').text(`DESC: ${parseFloat(discount).toFixed(2)}`);
        }
        printer.align('rt').style('B').text(`TOTAL: ${(total - (discount || 0)).toFixed(2)}`);
        if (payment_type) {
            printer.text(`Pago: ${payment_type}`);
        }

        printer
            .align('ct').style('NORMAL').text('Gracias por su preferencia!')
            .align('rt').style('NORMAL').text(getDateTime())
            .cut();
    });
}

async function printTicket(data, printerConfig) {
    const { company_name, sale_number, sale_type, table_number } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!sale_number || !sale_type){
        console.log('Formato de datos incorrecto')
        return;
    }

    const device = getDevice(printerConfig);

    await printWithDevice(device, (printer) => {
        printer
            .size(1, 1)
            .align('ct').style('B').text(company_name)
            .size(2, 3)
            .align('ct').style('NORMAL').text(`Ticket ${sale_number}`)
            .size(1, 1)
            .align('ct').style('B').text(`${sale_type}${table_number ? ' ' + table_number : ''}`)
            .text('')
            .align('rt').style('NORMAL').text(getDateTime())
            .cut();
    });
}

async function printComanda(data, printerConfig) {
    const { sale_number, sale_type, table_number, customer, details, observations, font_size: raw_font_size } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!sale_number || !details){
        console.log('Formato de datos incorrecto')
        return;
    }

    const fontSize = !isNaN(raw_font_size) ? parseInt(raw_font_size) : 0;
    const device = getDevice(printerConfig);

    await printWithDevice(device, (printer) => {
        printer
            .size(0, 0 + fontSize)
            .align('ct').style('B')
            .text(`Ticket ${sale_number}`)
            .text(`${sale_type}${table_number ? ' ' + table_number : ''}`)
            .style('NORMAL')
            .align('lt')
            .tableCustom([
                { text: 'Nombre:', align: 'LEFT' },
                { text: customer || 'Sin nombre', align: 'RIGHT' }
            ])
            .size(0, 0)
            .drawLine()
            .size(0, 1)
            .align('lt');

        (details || []).forEach(item => {
            printer.tableCustom([
                { text: item.quantity, align: 'LEFT', width: 0.1 },
                { text: item.product, align: 'LEFT', width: 0.5 },
                { text: item.total.toFixed(2), align: 'RIGHT', width: 0.4 }
            ]);
        });

        if (observations) {
            printer.size(0, 0).drawLine().size(0, 0 + fontSize);
            printer.align('lt').style('NORMAL').text(`Obs. ${observations}`);
        }

        printer
            .size(0, 0)
            .text('')
            .align('rt').style('NORMAL').text(getDateTime())
            .cut();
    });
}

async function printCloseBox(data, printerConfig) {
    const { user, date, opening_amount, income_amount, expenses_amount, closed_amount, missing_amount, surplus_amount, qr_amount, products } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!user || !date){
        console.log('Formato de datos incorrecto')
        return;
    }

    const device = getDevice(printerConfig);

    await printWithDevice(device, (printer) => {
        printer
            .align('ct').style('B').size(1, 1).text('CIERRE DE CAJA')
            .size(0, 0).style('NORMAL')
            .text(`Usuario: ${user}`)
            .text(`Fecha: ${date}`)
            .drawLine()
            .align('lt')
            .text(`Apertura:   ${parseFloat(opening_amount).toFixed(2)}`)
            .text(`Ingresos:   ${parseFloat(income_amount).toFixed(2)}`)
            .text(`Gastos:     ${parseFloat(expenses_amount).toFixed(2)}`)
            .text(`Cierre:     ${parseFloat(closed_amount).toFixed(2)}`)
            .text(`Faltante:   ${parseFloat(missing_amount).toFixed(2)}`)
            .text(`Sobrante:   ${parseFloat(surplus_amount).toFixed(2)}`)
            .text(`Pagos QR:   ${parseFloat(qr_amount).toFixed(2)}`)
            .drawLine();

        if (products && products.length > 0) {
            printer
                .style('B')
                .tableCustom([
                    { text: 'Producto', align: 'LEFT', width: 0.5 },
                    { text: 'Inicio', align: 'RIGHT', width: 0.25 },
                    { text: 'Fin', align: 'RIGHT', width: 0.25 }
                ])
                .style('NORMAL');
            products.forEach(p => {
                printer.tableCustom([
                    { text: p.name, align: 'LEFT', width: 0.5 },
                    { text: p.opening !== null ? p.opening.toString() : 'NN', align: 'RIGHT', width: 0.25 },
                    { text: p.closed !== null ? p.closed.toString() : 'NN', align: 'RIGHT', width: 0.25 }
                ]);
            });
            printer
                .size(0, 0)
                .drawLine();
        }
        
        printer
            .size(0, 0)
            .align('rt').style('NORMAL').text(`Impreso: ${getDateTime()}`)
            .cut();
    });
}

function getDateTime(){
    const ahora = new Date();

    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
    const año = String(ahora.getFullYear()).slice(-2);
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${año} ${horas}:${minutos}`;
}

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
