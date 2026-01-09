// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('node:path');

let mainWindow = null;
let tray = null;

// Previene que se abran múltiples instancias de la aplicación.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Si alguien intenta ejecutar una segunda instancia, enfocamos nuestra ventana.
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        show: false,
        skipTaskbar: false, // Se mostrará en la barra de tareas cuando sea visible
        icon: path.join(__dirname, 'assets/images', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'pages', 'index.html'));

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
            mainWindow.hide(); // Ocultar la ventana en lugar de cerrarla
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

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

// No hacer nada cuando todas las ventanas se cierran, la aplicación seguirá en la bandeja.
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

// Hacer reload cuando se hacen cambios
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`)
});