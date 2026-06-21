const express = require('express');
const cors = require('cors');
const { getPrinter } = require('./printer-adapter');

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
        const adapter = getPrinter(getRequestConfig(req.query));
        let printSuccess = false;

        await adapter.print((printer) => {
            printer
                .size(1, 1)
                .align('ct').style('NORMAL')
                .text(`Impresión de prueba`)
                .size(0, 0)
                .text('desarrollocreativo.dev')
                .text('')
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
            case 'inventario':
                await printInventory(data, printerConfig);
                break;
            case 'recibo_tienda':
                await printStoreReceipt(data, printerConfig);
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

// Compatibilidad hacia atrás: si ?ip=... llega en query params, sobrescribe config
// de disco solo para esa petición (no persiste).
function getRequestConfig(queryParams) {
    const base = typeof global.getAppConfig === 'function' ? global.getAppConfig() : {};
    if (queryParams && queryParams.ip) {
        return Object.assign({}, base, {
            connectionType: 'network',
            network: {
                ip: queryParams.ip,
                port: parseInt(queryParams.port) || 9100,
            },
        });
    }
    return base;
}

// --- Lógica de Plantillas de Impresión ---

async function printRecipe(data, printerConfig) {
    const { company_name, sale_number, payment_type, sale_type, table_number, discount, customer, details, font_size: raw_font_size, employee } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!sale_number || !details){
        console.log('Formato de datos incorrecto')
        return;
    }

    const fontSize = !isNaN(raw_font_size) ? parseInt(raw_font_size) : 0;
    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
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
            .align('ct').style('NORMAL').text('Gracias por su preferencia!');

        if (employee) {
            printer.tableCustom([
                { text: `Atendido por: ${employee}`, align: 'LEFT', width: 0.6 },
                { text: getDateTime(), align: 'RIGHT', width: 0.4 }
            ]);
        } else {
            printer.align('rt').style('NORMAL').text(getDateTime());
        }

        printer
            .text('')
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

    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
        printer
            .size(1, 1)
            .align('ct').style('B').text(company_name)
            .size(2, 3)
            .align('ct').style('NORMAL').text(`Ticket ${sale_number}`)
            .size(1, 1)
            .align('ct').style('B').text(`${sale_type}${table_number ? ' ' + table_number : ''}`)
            .text('')
            .align('rt').style('NORMAL').text(getDateTime())
            .text('')
            .cut();
    });
}

async function printComanda(data, printerConfig) {
    const { sale_number, sale_type, table_number, customer, details, observations, font_size: raw_font_size, employee } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!sale_number || !details){
        console.log('Formato de datos incorrecto')
        return;
    }

    const fontSize = !isNaN(raw_font_size) ? parseInt(raw_font_size) : 0;
    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
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

        printer.size(0, 0).text('');

        if (employee) {
            printer.tableCustom([
                { text: `Atendido por: ${employee}`, align: 'LEFT', width: 0.6 },
                { text: getDateTime(), align: 'RIGHT', width: 0.4 }
            ]);
        } else {
            printer.align('rt').style('NORMAL').text(getDateTime());
        }

        printer
            .text('')
            .cut();
    });
}

async function printCloseBox(data, printerConfig) {
    const { user, date, opening_amount, income_amount, expenses_amount, closed_amount, missing_amount, surplus_amount, qr_amount, total_sales_amount, products, sales, money } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!user || !date){
        console.log('Formato de datos incorrecto')
        return;
    }

    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
        printer
            .align('ct').style('B').size(1, 1).text('CIERRE DE CAJA')
            .size(0, 0).style('NORMAL')
            .text(`Usuario: ${user}`)
            .text(`Fecha: ${date}`)
            .drawLine()
            .style('B')
            .align('ct')
            .text('RESUMEN')
            .style('NORMAL')

            .tableCustom([
                { text: 'Apertura', align: 'LEFT', width: 0.5 },
                { text: parseFloat(opening_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Ingresos', align: 'LEFT', width: 0.5 },
                { text: parseFloat(income_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Gastos', align: 'LEFT', width: 0.5 },
                { text: parseFloat(expenses_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Cierre', align: 'LEFT', width: 0.5 },
                { text: parseFloat(closed_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Faltante', align: 'LEFT', width: 0.5 },
                { text: parseFloat(missing_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Sobrante', align: 'LEFT', width: 0.5 },
                { text: parseFloat(surplus_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .tableCustom([
                { text: 'Pagos QR', align: 'LEFT', width: 0.5 },
                { text: parseFloat(qr_amount).toFixed(2), align: 'RIGHT', width: 0.5 },
            ])
            .drawLine();

        if (products && products.length > 0) {
            printer
                .style('B')
                .align('ct')
                .text('INVENTARIO')
                .align('lt')
                .tableCustom([
                    { text: 'Producto', align: 'LEFT', width: 0.6 },
                    { text: 'Inicio', align: 'RIGHT', width: 0.2 },
                    { text: 'Fin', align: 'RIGHT', width: 0.2 }
                ])
                .style('NORMAL');
            products.forEach(p => {
                printer.tableCustom([
                    { text: p.name, align: 'LEFT', width: 0.6 },
                    { text: p.opening !== null ? p.opening.toString() : 'NN', align: 'RIGHT', width: 0.2 },
                    { text: p.closed !== null ? p.closed.toString() : 'NN', align: 'RIGHT', width: 0.2 }
                ]);
            });
            printer
                .size(0, 0)
                .drawLine();
        }

        if (sales && sales.length > 0) {
            printer
                .style('B')
                .align('ct')
                .text('VENTAS')
                .align('lt')
                .tableCustom([
                    { text: 'Producto', align: 'LEFT', width: 0.6 },
                    { text: 'Cant.', align: 'RIGHT', width: 0.2 },
                    { text: 'Total', align: 'RIGHT', width: 0.2 }
                ])
                .style('NORMAL');
            sales.forEach(p => {
                printer.tableCustom([
                    { text: p.product, align: 'LEFT', width: 0.6 },
                    { text: p.quantity, align: 'RIGHT', width: 0.2 },
                    { text: p.total, align: 'RIGHT', width: 0.2 },
                ]);
            });

            printer
                .style('B')
                .tableCustom([
                    { text: 'TOTAL VENTAS', align: 'LEFT', width: 0.6 },
                    { text: parseFloat(total_sales_amount).toFixed(2), align: 'RIGHT', width: 0.4 },
                ])
                .style('NORMAL')
                .size(0, 0)
                .drawLine();
        }

        if (money && money.length > 0) {
            printer
                .style('B')
                .align('ct')
                .text('CORTES DE BILLETES')
                .align('lt')
                .tableCustom([
                    { text: 'Corte', align: 'LEFT', width: 0.75 },
                    { text: 'Cant.', align: 'RIGHT', width: 0.25 }
                ])
                .style('NORMAL');
            money.forEach(p => {
                printer.tableCustom([
                    { text: p.amount, align: 'LEFT', width: 0.75 },
                    { text: p.quantity, align: 'RIGHT', width: 0.25 },
                ]);
            });
            printer
                .size(0, 0)
                .drawLine();
        }
        
        printer
            .size(0, 0)
            .align('rt').style('NORMAL').text(`Impreso: ${getDateTime()}`)
            .text('')
            .cut();
    });
}

async function printInventory(data, printerConfig) {
    const { user, branch, products } = data;

    // Validar que la petición contenga el formato de datos correcto
    if(!products){
        console.log('Formato de datos incorrecto')
        return;
    }

    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
        printer
            .align('ct').style('B').size(1, 1).text('INVENTARIO')
            .size(0, 0).style('NORMAL')
            .text(`Usuario: ${user}`)
            .text(`Sucursal: ${branch}`)
            .drawLine()
            .style('NORMAL')

        if (products && products.length > 0) {
            printer
                .style('B')
                .align('lt')
                .tableCustom([
                    { text: 'Producto', align: 'LEFT', width: 0.8 },
                    { text: 'stock', align: 'RIGHT', width: 0.2 }
                ])
                .style('NORMAL');
            products.forEach(p => {
                printer.tableCustom([
                    { text: p.name, align: 'LEFT', width: 0.8 },
                    { text: p.stock.toString(), align: 'RIGHT', width: 0.2 }
                ]);
            });
            printer
                .size(0, 0)
                .drawLine();
        }
        
        printer
            .align('rt').style('NORMAL').text(`Impreso: ${getDateTime()}`)
            .text('')
            .cut();
    });
}

async function printStoreReceipt(data, printerConfig) {
    const { company_name, sale_number, customer, details, discount, tax, payment_type, font_size: raw_font_size, employee } = data;

    if (!sale_number || !details) {
        console.log('Formato de datos incorrecto');
        return;
    }

    const fontSize = !isNaN(raw_font_size) ? parseInt(raw_font_size) : 0;
    const adapter = getPrinter(getRequestConfig(printerConfig));

    await adapter.print((printer) => {
        printer
            .align('ct').style('B').size(0, 0 + fontSize).text(company_name)
            .size(0, 0 + fontSize)
            .align('ct').style('B').text(`Recibo ${sale_number}`)
            .style('NORMAL')
            .align('lt');

        if (customer) {
            printer.tableCustom([
                { text: 'Cliente:', align: 'LEFT' },
                { text: customer, align: 'RIGHT' }
            ]);
        }

        printer
            .size(0, 0)
            .drawLine()
            .style('B')
            .tableCustom([
                { text: 'Cant.', align: 'LEFT',  width: 0.08 },
                { text: 'Producto',  align: 'LEFT',  width: 0.47 },
                { text: 'P.Unit',    align: 'RIGHT', width: 0.22 },
                { text: 'Total',     align: 'RIGHT', width: 0.23 },
            ])
            .style('NORMAL')
            .size(0, 0 + fontSize)
            .align('lt');

        let subtotal = 0;
        (details || []).forEach(item => {
            printer.tableCustom([
                { text: String(item.quantity),              align: 'LEFT',  width: 0.08 },
                { text: item.product,                       align: 'LEFT',  width: 0.47 },
                { text: parseFloat(item.unit_price).toFixed(2), align: 'RIGHT', width: 0.22 },
                { text: parseFloat(item.total).toFixed(2),      align: 'RIGHT', width: 0.23 },
            ]);
            subtotal += parseFloat(item.total);
        });

        printer.size(0, 0).drawLine().size(0, 0 + fontSize);

        if (discount) {
            printer.align('rt').style('NORMAL').text(`Descuento: -${parseFloat(discount).toFixed(2)}`);
        }
        if (tax) {
            printer.align('rt').style('NORMAL').text(`IVA: ${parseFloat(tax).toFixed(2)}`);
        }

        const total = subtotal - (discount || 0) + (tax || 0);
        printer.align('rt').style('B').text(`TOTAL: ${total.toFixed(2)}`);

        if (payment_type) {
            printer.align('rt').style('NORMAL').text(`Pago: ${payment_type}`);
        }

        printer
            .align('ct').style('NORMAL').text('Gracias por su compra!');

        if (employee) {
            printer.tableCustom([
                { text: `Atendido por: ${employee}`, align: 'LEFT', width: 0.6 },
                { text: getDateTime(), align: 'RIGHT', width: 0.4 }
            ]);
        } else {
            printer.align('rt').style('NORMAL').text(getDateTime());
        }

        printer
            .text('')
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
