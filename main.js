// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')

const { NODE_ENV } = process.env;

const isDev = NODE_ENV === 'dev';
const basePath = isDev ? __dirname : process.resourcesPath;

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
    // mainWindow.loadFile('pages/index.html')
    const serverPath = `file://${path.join(__dirname, 'pages', 'index.html')}`;
    mainWindow.loadURL(serverPath);

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

function startServer() {
    const serverPath = path.join(__dirname, 'server.js');
    require(serverPath);
}

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



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.