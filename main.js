// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')

// Dependencias del servidor de impresión
const express = require('express');
const escpos = require('escpos'); // Módulo escpos
escpos.USB = require('escpos-usb'); // Soporte para USB

const server = express();

require('dotenv').config();
const { SERVER_URL, SERVER_PORT } = process.env;

// Middleware para manejar JSON
server.use(express.json());
// Fin de dependencias

// Solo para entorno de desarrollo
// require('electron-reload')(path.join(__dirname, 'pages'), {
//   electron: require(`${__dirname}/node_modules/electron`),
// });


const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        // show: false,
        icon: path.join(__dirname, 'assets/images', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // and load the index.html of the app.
    mainWindow.loadFile('pages/index.html')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

     // Interceptar el evento de cierre de la ventana
    mainWindow.on('close', (event) => {
    // Mostrar un cuadro de diálogo de confirmación
    const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Cancelar', 'Cerrar'],
        defaultId: 1,
        title: 'Confirmar cierre',
        message: '¿Estás seguro de que deseas cerrar la aplicación?'
    });

    // Si el usuario selecciona 'Cancelar', prevenir el cierre
    if (response === 0) {
        event.preventDefault();
    }
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Rutas del servidor
server.get('/test', (req, res) => {
    try {
        console.log('Servidor activo')
        var device = null;
        try {
            device = new escpos.USB();
        } catch (error) {
            console.log('Error al conectarse a la impresora')
        }
        res.send({
            success: 1,
            message: 'Servidor activo',
            details: {
                print: device
            }
        });
    } catch (error) {
        console.error('Error en la petición', error);
        res.status(500).send({error: 1, message: 'Error en la petición http'});
    }
});

// Ruta para imprimir ticket
server.post('/print', (req, res) => {
    try {
        var { templeate } = req.body;

        switch (templeate) {
            case 'comanda':
                printComanda(req);
                break;
            default:
                printTemplateNormal(req);
                printComanda(req);
                break;
        }
        res.send({success: 1, message: 'Ticket impreso correctamente'});
    } catch (error) {
        console.error('Error en la petición', error);
        res.status(500).send({error: 1, message: 'Error al imprimir el ticket'});
    }
});

function printTemplateNormal(req){
    try {
        // Datos del cuerpo de la solicitud
        const { company_name, sale_number, payment_type, sale_type, table_number, discount, details, observations } = req.body;

        // Conectar a la impresora USB
        const device = new escpos.USB(); // Detecta automáticamente el dispositivo
        const printer = new escpos.Printer(device);

        device.open((error) => {
            if (error) {
                console.error('Error al abrir la impresora:', error);
                return res.status(500).send('Error al abrir la impresora');
            }

            // Iniciar impresión
            printer
                .align('ct').style('B').size(1, 1).text(company_name) // Nombre del restaurante
                .size(0, 0)
                .align('ct').style('NORMAL').text(`Ticket ${sale_number}`) // Número de ticket
                .size(0, 0)
                .align('ct').style('NORMAL').text(`${sale_type}${table_number ? ' '+table_number : ''}`) // Número de mesa
                .drawLine()
                .align('lt');

            // Imprimir los artículos
            var total = 0;
            details.forEach(item => {
                printer.tableCustom([
                    { text: item.product, align: 'LEFT', width: 0.56 },
                    { text: item.quantity, align: 'CENTER', width: 0.10 },
                    { text: `Bs.${item.total.toFixed(2)}`, align: 'RIGHT', width: 0.33 }
                ]);
                total += parseFloat(item.total);
            });

            printer.drawLine();
            if (discount) {
                printer.align('rt').style('B').text(`DESC: Bs.${discount.toFixed(2)}`);   
            }
            printer.align('rt').style('B').text(`TOTAL: Bs.${(total - discount).toFixed(2)}`);
            if (payment_type) {
                printer.text(`Pago: ${payment_type}`);   
            }
            printer.text('');
            printer.align('ct').style('NORMAL').text('Gracias por su preferencia!');
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
        // Datos del cuerpo de la solicitud
        const { sale_number, sale_type, table_number, discount, details, observations } = req.body;

        // Conectar a la impresora USB
        const device = new escpos.USB(); // Detecta automáticamente el dispositivo
        const printer = new escpos.Printer(device);

        device.open((error) => {
            if (error) {
                console.error('Error al abrir la impresora:', error);
                return res.status(500).send('Error al abrir la impresora');
            }

            // Iniciar impresión
            printer
                .align('ct').style('NORMAL').text(`Ticket ${sale_number}`)
                .size(0, 0)
                .align('ct').style('NORMAL').text(`${sale_type}${table_number ? ' '+table_number : ''}`)
                .drawLine()
                .align('lt');

            // Imprimir los artículos
            var total = 0;
            details.forEach(item => {
                printer.tableCustom([
                    { text: item.product, align: 'LEFT', width: 0.56 },
                    { text: item.quantity, align: 'CENTER', width: 0.10 },
                    { text: `Bs.${item.total.toFixed(2)}`, align: 'RIGHT', width: 0.33 }
                ]);
                total += parseFloat(item.total);
            });

            printer.drawLine();
            if (observations) {
                printer.align('lt').style('NORMAL').text(`Obs. ${observations}`);   
            }
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

// Inicio del servidor
server.listen(SERVER_PORT, () => {
    console.log(`Servidor escuchando en ${SERVER_URL}:${SERVER_PORT}`);
});