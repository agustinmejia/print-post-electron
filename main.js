// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, Tray, Menu } = require('electron')
const path = require('node:path')

let mainWindow = null;
let tray = null;

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        show: false,
        skipTaskbar: true,
        icon: path.join(__dirname, 'assets/images', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // and load the index.html of the app.
    // mainWindow.loadFile('pages/index.html')
    const serverPath = `file://${path.join(__dirname, 'pages', 'index.html')}`;
    mainWindow.loadURL(serverPath);

    // Minimiza la ventana al iniciarse
    mainWindow.minimize();

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Configurar bandeja del sistema
    tray = new Tray(path.join(__dirname, 'assets/images', 'icon.png'));
    tray.setToolTip('Impresora App');

    // Crear un menú contextual para la bandeja
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Restaurar',
            click: () => {
                mainWindow.show();
                mainWindow.restore();
            }
        },
        {
            label: 'Cerrar',
            click: () => {
                app.quit(); // Cierra la aplicación completamente
            }
        }
    ]);
    tray.setContextMenu(contextMenu);

    // Mostrar la ventana al hacer clic en el ícono de la bandeja
    tray.on('click', () => {
        mainWindow.show();
        mainWindow.restore();
    });

    // Interceptar el evento de cierre de la ventana
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault(); // Prevenir el cierre
            mainWindow.hide(); // Ocultar la ventana
            mainWindow.minimize(); // Minimizar a la bandeja
        }
    });
}

function startServer() {
    const serverPath = path.join(__dirname, 'server.js');
    try {
        require(serverPath);
        console.log('Servidor Express iniciado correctamente');
    } catch (error) {
        console.error('Error al iniciar el servidor Express:', error);
    }
}

app.setName('dc-pos-printer');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    startServer();
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



// Evitar que la aplicación se cierre al cerrar todas las ventanas
app.on('window-all-closed', () => {
    // No cerrar la aplicación en Windows (mantener en la bandeja)
    // if (process.platform !== 'darwin') app.quit();
});

// Permitir cerrar la aplicación desde el menú de la bandeja
app.on('before-quit', () => {
    app.isQuitting = true; // Indicar que se está cerrando intencionalmente
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.