'use strict';

const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const { PosPrinter } = require('electron-pos-printer');

// Fake ESC/POS device: acumula bytes para enviar vía sendRawCommand (modo Windows driver)
class BufferDevice {
    constructor() {
        this._chunks = [];
    }
    open(cb) { cb(null); }
    write(data, cb) {
        this._chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        if (cb) cb(null);
    }
    close(cb) { if (cb) cb(null); }
    getBuffer() { return Buffer.concat(this._chunks); }
}

// Flujo ESC/POS compartido por NetworkAdapter y LibUsbAdapter
function printEscPos(device, printCommands, cashDrawer) {
    return new Promise((resolve, reject) => {
        try {
            const printer = new escpos.Printer(device, { encoding: 'CP850' });
            device.open((error) => {
                if (error) return reject(new Error(`Error al abrir la impresora: ${error.message}`));
                try {
                    printCommands(printer);
                    if (cashDrawer && cashDrawer.enabled) {
                        try {
                            printer.cashdraw(cashDrawer.pin || 2);
                        } catch (drawerErr) {
                            console.error('CashDrawerError:', drawerErr.message);
                        }
                    }
                    printer.close((closeError) => {
                        if (closeError) console.warn(`Advertencia al cerrar impresora: ${closeError.message}`);
                        resolve();
                    });
                } catch (printError) {
                    reject(new Error(`Error durante la impresión: ${printError.message}`));
                }
            });
        } catch (deviceError) {
            reject(new Error(`Error al inicializar el dispositivo: ${deviceError.message}`));
        }
    });
}

class NetworkAdapter {
    constructor(config) {
        this._ip = config.network.ip;
        this._port = config.network.port || 9100;
        this._cashDrawer = config.cashDrawer;
    }
    print(printCommands) {
        console.log(`Conectando a impresora de red en ${this._ip}:${this._port}`);
        const device = new escpos.Network(this._ip, this._port);
        return printEscPos(device, printCommands, this._cashDrawer);
    }
}

class LibUsbAdapter {
    constructor(config) {
        this._cashDrawer = config.cashDrawer;
        this._deviceId = config.usb && config.usb.deviceId ? config.usb.deviceId : null;
    }
    print(printCommands) {
        let device;
        if (this._deviceId) {
            const parts = this._deviceId.split(':');
            const vid = parseInt(parts[0], 10);
            const pid = parseInt(parts[1], 10);
            console.log(`Conectando a impresora USB LibUSB (0x${vid.toString(16)}:0x${pid.toString(16)})`);
            device = new escpos.USB(vid, pid);
        } else {
            console.log('Conectando a impresora USB LibUSB (primera encontrada)');
            device = new escpos.USB();
        }
        return printEscPos(device, printCommands, this._cashDrawer);
    }
}

class WindowsDriverAdapter {
    constructor(config) {
        this._printerName = config.usb.printerName;
        this._cashDrawer = config.cashDrawer;
    }
    print(printCommands) {
        const self = this;
        return new Promise((resolve, reject) => {
            const bufferDevice = new BufferDevice();
            try {
                const printer = new escpos.Printer(bufferDevice, { encoding: 'CP850' });
                bufferDevice.open((err) => {
                    if (err) return reject(err);
                    try {
                        printCommands(printer);
                        printer.close(async (closeErr) => {
                            if (closeErr) console.warn('BufferDevice close:', closeErr.message);
                            try {
                                const rawBytes = bufferDevice.getBuffer();
                                console.log(`Enviando ${rawBytes.length} bytes a "${self._printerName}" (Windows driver)`);
                                await PosPrinter.sendRawCommand(self._printerName, rawBytes);
                                if (self._cashDrawer && self._cashDrawer.enabled) {
                                    await PosPrinter.openCashDrawer(self._printerName, { pin: self._cashDrawer.pin || 2 });
                                }
                                resolve();
                            } catch (sendErr) {
                                reject(sendErr);
                            }
                        });
                    } catch (printErr) {
                        reject(new Error(`Error durante la impresión: ${printErr.message}`));
                    }
                });
            } catch (deviceErr) {
                reject(new Error(`Error al inicializar BufferDevice: ${deviceErr.message}`));
            }
        });
    }
}

function getPrinter(config) {
    const { connectionType, usbMode } = config;

    if (connectionType === 'network') {
        if (!config.network || !config.network.ip) {
            throw new Error('Config de red incompleta: falta IP');
        }
        return new NetworkAdapter(config);
    }

    if (connectionType === 'usb') {
        if (usbMode === 'windows') {
            if (!config.usb || !config.usb.printerName) {
                throw new Error('Config USB Windows incompleta: falta printerName');
            }
            return new WindowsDriverAdapter(config);
        }
        return new LibUsbAdapter(config);
    }

    throw new Error(`connectionType no válido: "${connectionType}"`);
}

module.exports = { getPrinter };
