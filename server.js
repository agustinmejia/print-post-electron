const express = require('express');
const cors = require('cors');
const escpos = require('escpos'); // Módulo escpos
escpos.USB = require('escpos-usb'); // Soporte para USB
escpos.Network = require('escpos-network'); // Soporte para red

const app = express();
const port = 3010;
const corsOptions ={
    origin:'*', 
    credentials:true,            //access-control-allow-credentials:true
    optionSuccessStatus:200,
 }

// Middleware para manejar JSON
app.use(express.json());

app.use(cors(corsOptions))

// Ruta para imprimir ticket
app.get('/', (req, res) => {
    console.log('Servicio activo')
    res.send({success: 1, message: 'Servicio activo'});
})

app.get('/test', (req, res) => {
    try {
        console.log('Servicio activo');

        const { ip, port } = req.query;

        var device = null;
        try {
            // Si se envía la IP mediante un parámetro get se usa el conector de res, sino el de USB
            device = ip ? new escpos.Network(ip, port ? port : 9100) : new escpos.USB();
            const printer = new escpos.Printer(device, { encoding: "CP850" });

            device.open((error) => {
                if (error) {
                    console.error('Error al abrir la impresora:', error);
                }
                printer
                    .size(1, 1)
                    .align('ct').style('NORMAL')
                    .text(`Impresión de prueba`)
                    .size(0, 0)
                    .text('desarrollocreativo.dev')
                printer.text('');
                printer.cut();
                printer.close();
            });

        } catch (error) {
            console.log('Error al conectarse a la impresora')
        }
        res.send({
            success: 1,
            message: 'Servidor activo',
            details: {
                print: device ? 1 : null
            }
        });
    } catch (error) {
        console.error('Error en la petición', error);
        res.status(500).send({error: 1, message: 'Error en la petición http'});
    }
});

app.post('/print', (req, res) => {
    try {
        var { templeate } = req.body;

        switch (templeate) {
            case 'recibo':
                printTemplateNormal(req);
                break;
            case 'ticket':
                printTicket(req);
                break;
            case 'comanda':
                printComanda(req);
                break;
            case 'ticket_comanda':
                printTicket(req);
                printComanda(req);
                break;
            default:
                printTemplateNormal(req);
                printComanda(req);
                break;
        }
        res.send('Ticket impreso correctamente');
    } catch (error) {
        console.error('Error en la petición', error);
        res.status(500).send('Error al imprimir el ticket');
    }
});

function printTemplateNormal(req){
    try {

        const { ip, port } = req.query;

        // Datos del cuerpo de la solicitud
        var { company_name, sale_number, payment_type, sale_type, table_number, discount, customer, details, font_size } = req.body;

        // Formatear el valor para evitar errores
        font_size = !isNaN(font_size) ? parseInt(font_size) : 0;

        // Si se envía la ip mediante un parámetro get se usa el conector de red, sino el de USB
        const device = ip ? new escpos.Network(ip, port ? port : 9100) : new escpos.USB();
        const printer = new escpos.Printer(device, { encoding: "CP850" });

        device.open((error) => {
            if (error) {
                console.error('Error al abrir la impresora:', error);
                // return res.status(500).send('Error al abrir la impresora');
                return null;
            }

            // Iniciar impresión
            printer
                .align('ct').style('B').size(1 + font_size, 1).text(company_name) // Nombre del restaurante
                .size(0 + font_size, 0)
                .align('ct').style('B')
                .text(`Ticket ${sale_number}`) // Número de ticket
                .text(`${sale_type}${table_number ? ' '+table_number : ''}`) // Número de mesa
                .style('NORMAL')
                
                // Datos del cliente
                .align('lt')
                .text('')
                .tableCustom([
                    { text: 'Nombre:', align: 'LEFT'},
                    { text: customer, align: 'RIGHT'}
                ])
                
                .size(0, 0)
                .drawLine()
                .size(0 + font_size, 0)
                .align('lt');

            // Imprimir los artículos
            var total = 0;
            details.forEach(item => {
                printer.tableCustom([
                    { text: item.quantity, align: 'LEFT', width: 0.10 },
                    { text: item.product, align: 'LEFT', width: 0.56 },
                    { text: item.total.toFixed(2), align: 'RIGHT', width: 0.33 }
                ]);
                total += parseFloat(item.total);
            });

            printer.size(0, 0)
            printer.drawLine();
            printer.size(0 + font_size, 0)
            if (discount) {
                printer.align('rt').style('B').text(`DESC: ${parseFloat(discount).toFixed(2)}`);   
            }
            printer.align('rt').style('B').text(`TOTAL: ${(total - discount).toFixed(2)}`);
            if (payment_type) {
                printer.text(`Pago: ${payment_type}`);   
            }
            printer.text('');
            printer.align('ct').style('NORMAL').text('Gracias por su preferencia!');
            printer.text('');
            printer.align('rt').style('NORMAL').text(getDateTime());
            printer.text('');
            printer.cut();
            printer.close();

            return 1;
        });
    } catch (error) {
        console.error('Error al imprimir el ticket:', error);
        return 0;
    }
}

function printTicket(req){
    try {

        const { ip, port } = req.query;

        // Datos del cuerpo de la solicitud
        var { company_name, sale_number, sale_type, table_number } = req.body;

        // Si se envía la ip mediante un parámetro get se usa el conector de res, sino el de USB
        const device = ip ? new escpos.Network(ip, port ? port : 9100) : new escpos.USB();
        const printer = new escpos.Printer(device, { encoding: "CP850" });

        device.open((error) => {
            if (error) {
                console.error('Error al abrir la impresora:', error);
                return;
            }

            // Iniciar impresión
            printer
                .size(1, 1)
                .align('ct').style('B').text(company_name)
                .size(2, 3)
                .align('ct').style('NORMAL').text(`Ticket ${sale_number}`)
                .size(1, 1)
                .align('ct').style('B').text(`${sale_type}${table_number ? ' '+table_number : ''}`);
            printer.text('');
            printer.align('rt').style('NORMAL').text(getDateTime());
            printer.text('');
            printer.cut();
            printer.close();

            return 1;
        });
    } catch (error) {
        console.error('Error al imprimir el ticket:', error);
        return 0;
    }
}

function printComanda(req){
    try {

        const { ip, port } = req.query;

        // Datos del cuerpo de la solicitud
        var { sale_number, sale_type, table_number, customer, details, observations, font_size } = req.body;

        // Formatear el valor para evitar errores
        font_size = !isNaN(font_size) ? parseInt(font_size) : 0;

        // Si se envía la ip mediante un parámetro get se usa el conector de res, sino el de USB
        const device = ip ? new escpos.Network(ip, port ? port : 9100) : new escpos.USB();
        const printer = new escpos.Printer(device, { encoding: "CP850" });

        device.open((error) => {
            if (error) {
                console.error('Error al abrir la impresora:', error);
                return res.status(500).send('Error al abrir la impresora');
            }

            // Iniciar impresión
            printer
                .size(0 + font_size, 0)
                .align('ct').style('B')
                .text(`Ticket ${sale_number}`)
                .text(`${sale_type}${table_number ? ' '+table_number : ''}`)
                .style('NORMAL')

                // Datos del cliente
                .align('lt')
                .text('')
                .tableCustom([
                    { text: 'Nombre:', align: 'LEFT'},
                    { text: customer, align: 'RIGHT'}
                ])

                .size(0, 0)
                .drawLine()
                .size(0 + font_size, 0)
                .align('lt');

            // Imprimir los artículos
            var total = 0;
            details.forEach(item => {
                printer.tableCustom([
                    { text: item.quantity, align: 'LEFT', width: 0.10 },
                    { text: item.product, align: 'LEFT', width: 0.56 },
                    { text: item.total.toFixed(2), align: 'RIGHT', width: 0.33 }
                ]);
                total += parseFloat(item.total);
            });

            if (observations) {
                printer.size(0, 0);
                printer.drawLine();
                printer.size(0 + font_size, 0)
                printer.align('lt').style('NORMAL').text(`Obs. ${observations}`);   
            }
            printer.text('');
            printer.align('rt').style('NORMAL').text(getDateTime());
            printer.text('');
            printer.cut();
            printer.close();

            return 1;
        });
    } catch (error) {
        console.error('Error al imprimir el ticket:', error);
        return 0;
    }
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
