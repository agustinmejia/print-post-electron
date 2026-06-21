// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let mainWindow = null;
let tray = null;

// --- Configuración persistente ---

const DEFAULT_CONFIG = {
    connectionType: 'network',
    usbMode: 'windows',
    network: { ip: '', port: 9100 },
    usb: { printerName: '', deviceId: '' },
    cashDrawer: { enabled: false, pin: 2 },
};

function getConfigPath() {
    return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
    const configPath = getConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
        }
    } catch (err) {
        console.error('Error leyendo config.json, usando defaults:', err.message);
    }
    return Object.assign({}, DEFAULT_CONFIG);
}

function saveConfig(config) {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

let appConfig = loadConfig();

// Asegurar que el archivo existe en disco con valores actuales
try {
    if (!fs.existsSync(getConfigPath())) {
        saveConfig(appConfig);
    }
} catch (err) {
    console.error('Error inicializando config.json:', err.message);
}

// --- Handlers IPC ---

ipcMain.handle('config:get', () => {
    return appConfig;
});

ipcMain.handle('config:set', (event, partial) => {
    appConfig = deepMerge(appConfig, partial);
    saveConfig(appConfig);
    return appConfig;
});

ipcMain.handle('printers:list', async () => {
    if (!mainWindow) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
});

ipcMain.handle('usb:list', () => {
    try {
        const EscposUSB = require('escpos-usb');
        const devices = EscposUSB.findPrinter();
        return devices.map(d => {
            const vid = d.deviceDescriptor.idVendor;
            const pid = d.deviceDescriptor.idProduct;
            const vidHex = vid.toString(16).toUpperCase().padStart(4, '0');
            const pidHex = pid.toString(16).toUpperCase().padStart(4, '0');
            return {
                vendorId: vid,
                productId: pid,
                deviceId: `${vid}:${pid}`,
                label: `USB 0x${vidHex}:0x${pidHex}`,
            };
        });
    } catch (err) {
        console.error('usb:list error:', err.message);
        return [];
    }
});

function deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

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
        width: 750,
        height: 520,
        show: false,
        skipTaskbar: false, // Se mostrará en la barra de tareas cuando sea visible
        icon: path.join(__dirname, 'assets/images', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Abrir enlaces externos en el navegador predeterminado
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
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
        // Exponer getter de config para que server.js acceda sin IPC
        global.getAppConfig = () => appConfig;
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
// require('electron-reload')(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`)
// });