// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // --- Main Window APIs ---
    sendImage: (data) => ipcRenderer.invoke('send-image', data),
    minimizeApp: () => ipcRenderer.send('minimize-app'),
    maximizeApp: () => ipcRenderer.send('maximize-app'),
    closeApp: () => ipcRenderer.send('close-app'), 

    // --- Log Window API ---
    onLogUpdate: (callback) => ipcRenderer.on('log-update', (_event, value) => callback(value)),
    closeLogWindow: () => ipcRenderer.send('close-log-window'),

    // --- Computer List Management APIs ---
    loadComputers: () => ipcRenderer.invoke('load-computers'),
    saveComputers: (computers) => ipcRenderer.invoke('save-computers', computers),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options), 
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    // --- Online Status and Custom Recovery APIs ---
    checkComputerOnline: (ip, port) => ipcRenderer.invoke('check-computer-online', ip, port),
    showOpenDirectoryDialog: (options) => ipcRenderer.invoke('show-open-directory-dialog', options),

    // --- Image Processing API ---
    processImageForSending: (filePath) => ipcRenderer.invoke('process-image-for-sending', filePath),

    // --- About Window API (New) ---
    openAboutWindow: () => ipcRenderer.send('open-about-window')
  }
);
