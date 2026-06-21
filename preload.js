// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
    getPrinters: () => ipcRenderer.invoke('printers:list'),
    getUsbDevices: () => ipcRenderer.invoke('usb:list'),
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };
    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency]);
    }
});
