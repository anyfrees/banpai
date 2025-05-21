// main.js
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs'); 
const os = require('os'); 

// --- Application Data Storage ---
const appDataPath = app.getPath('userData'); 
const computerListDir = path.join(appDataPath, 'ImageSenderData'); 
const computerListFilePath = path.join(computerListDir, 'computers.json');

// Ensure data directory exists on startup
if (!fs.existsSync(computerListDir)) {
    try {
        fs.mkdirSync(computerListDir, { recursive: true });
        console.log(`Data directory created at: ${computerListDir}`);
    } catch (error) {
        console.error(`[Main] Failed to create data directory: ${computerListDir}`, error);
    }
}

// --- Window References ---
let mainWindow = null; 
let logWindow = null; 
let aboutWindow = null; // 关于窗口引用

// --- Helper Functions ---
/**
 * Extracts a number from a room name string (e.g., "计算机机房1" -> "1").
 * Used for default recovery image naming.
 * @param {string} roomName - The name of the room.
 * @returns {string|null} The extracted number string or null.
 */
function getRoomNumberFromName(roomName) {
    if (roomName) {
        const match = roomName.match(/\d+$/); 
        return match ? match[0] : null;
    }
    return null;
}

// --- Window Creation ---
function createMainWindow () {
  mainWindow = new BrowserWindow({ 
    width: 950,
    height: 720,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'assets', 'icon.png'), // 主窗口图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true 
    }
  });
  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); 
  mainWindow.on('closed', () => {
    mainWindow = null; 
    if (logWindow && !logWindow.isDestroyed()) { 
        logWindow.close();
    }
    logWindow = null;
    if (aboutWindow && !aboutWindow.isDestroyed()) { 
        aboutWindow.close();
    }
    aboutWindow = null;
    clearAllTempFiles(); 
  });
}

function createLogWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) { 
        console.log("[Main] Main window not available, cannot create log window.");
        return;
    }
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.show(); 
        logWindow.focus();
        return;
    }
    logWindow = new BrowserWindow({
        width: 550, 
        height: 420, 
        frame: false, 
        parent: mainWindow, 
        modal: false, 
        show: false, 
        resizable: true, 
        minimizable: true, 
        maximizable: true, 
        icon: path.join(__dirname, 'assets', 'icon.png'), // 日志窗口图标
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true 
        }
    });
    logWindow.loadFile(path.join(__dirname, 'log-window.html')); 
    // logWindow.webContents.openDevTools(); 

    logWindow.once('ready-to-show', () => {
        if (logWindow && !logWindow.isDestroyed()) {
           logWindow.show();
        }
    });

    logWindow.on('closed', () => {
        logWindow = null; 
        console.log("[Main] Log window closed.");
    });
}

function createAboutWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.log("[Main] Main window not available, cannot create about window.");
        return;
    }
    if (aboutWindow && !aboutWindow.isDestroyed()) {
        aboutWindow.focus();
        return;
    }
    aboutWindow = new BrowserWindow({
        width: 750, 
        height: 650, 
        frame: false, // 设置为无边框
        titleBarStyle: 'hidden', // 配合无边框，在macOS上效果更好
        parent: mainWindow, 
        modal: true, 
        show: false,
        resizable: true, 
        minimizable: true,
        maximizable: true, // 允许最大化，如果内容多的话
        title: '关于 图片发送端', 
        icon: path.join(__dirname, 'assets', 'icon.png'), 
        webPreferences: {
            // 关于页面如果内部有关闭按钮且需要与主进程通信关闭，则需要preload
            preload: path.join(__dirname, 'preload.js'), // 为 about.html 也使用 preload.js
            contextIsolation: true,
            nodeIntegration: false, 
            devTools: true // 调试时可以开启
        }
    });
    aboutWindow.loadFile(path.join(__dirname, 'about.html'));
    // aboutWindow.setMenuBarVisibility(false); // 无边框窗口通常没有菜单栏

    aboutWindow.once('ready-to-show', () => {
        if(aboutWindow && !aboutWindow.isDestroyed()) {
            aboutWindow.show();
        }
    });
    aboutWindow.on('closed', () => {
        aboutWindow = null;
        console.log("[Main] About window closed.");
    });
}


/**
 * Sends a log entry to the popup log window if it's open.
 * @param {object|Array<object>} logEntry - The log entry or an array of entries.
 */
function sendLogToPopup(logEntry) {
    if (logWindow && !logWindow.isDestroyed() && logWindow.webContents && !logWindow.webContents.isDestroyed()) { 
        try {
            logWindow.webContents.send('log-update', logEntry);
        } catch (error) {
            console.error("[Main] Failed to send log to popup:", error);
        }
    }
}

// --- Temporary File Management ---
/**
 * Deletes a temporary file if it exists.
 * @param {string} filePath - The path to the temporary file.
 */
function deleteTempFile(filePath) {
    if (filePath && filePath.includes(app.getPath('temp')) && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`[Main] Deleted temp file: ${filePath}`);
        } catch (unlinkError) {
            console.error(`[Main] Failed to delete temp file ${filePath}:`, unlinkError);
        }
    }
}
/**
 * Clears all known temporary image files created by this application.
 */
function clearAllTempFiles() {
    const tempDir = app.getPath('temp');
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            if (file.startsWith('processed_') || file.startsWith('truebmp_')) { 
                deleteTempFile(path.join(tempDir, file));
            }
        });
        console.log("[Main] Attempted to clear all known temp files.");
    } catch (err) {
        console.error("[Main] Error reading temp directory for cleanup:", err);
    }
}


// --- Application Lifecycle ---
app.whenReady().then(() => {
  createMainWindow(); 
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
    clearAllTempFiles();
});


// --- IPC Handlers ---
ipcMain.on('close-log-window', () => {
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.close();
    }
});

ipcMain.handle('load-computers', async () => {
    try {
        if (fs.existsSync(computerListFilePath)) {
            const data = fs.readFileSync(computerListFilePath, 'utf-8');
            console.log('[Main] Computers loaded from:', computerListFilePath);
            return JSON.parse(data);
        }
        console.log('[Main] No computer list file found, returning empty list.');
        return []; 
    } catch (error) {
        console.error('[Main] Failed to load computers:', error);
        return []; 
    }
});

ipcMain.handle('save-computers', async (event, computers) => {
    try {
        const jsonData = JSON.stringify(computers, null, 2); 
        fs.writeFileSync(computerListFilePath, jsonData, 'utf-8');
        console.log('[Main] Computers saved to:', computerListFilePath);
        return { success: true };
    } catch (error) {
        console.error('[Main] Failed to save computers:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const activeWindow = BrowserWindow.getFocusedWindow() || mainWindow; 
    if (!activeWindow || activeWindow.isDestroyed()) { 
        console.error("[Main] show-open-dialog: No window available to show dialog.");
        return { canceled: true, filePaths: [] };
    }
    try {
        const result = await dialog.showOpenDialog(activeWindow, options);
        return result;
    } catch (error) {
        console.error("[Main] Error in showOpenDialog:", error);
        return { canceled: true, filePaths: [] };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return { success: true, data: data };
    } catch (error) {
        console.error(`[Main] Failed to read file ${filePath}:`, error);
        return { success: false, error: error.message };
    }
});

// 处理图片（转换、重命名，生成真BMP）
ipcMain.handle('process-image-for-sending', async (event, originalFilePath) => {
    console.log('[Main] Received processImageForSending for:', originalFilePath);
    if (!originalFilePath || !fs.existsSync(originalFilePath)) {
        return { success: false, error: '原始文件路径无效或文件不存在。' };
    }

    let tempFilePath = null; 

    try {
        // --- Filename Sanitization (Done first) ---
        let originalFileName = path.basename(originalFilePath);
        let originalFileExt = path.extname(originalFileName).toLowerCase();
        let baseNameWithoutExt = path.basename(originalFileName, originalFileExt);
        const nonAsciiRegex = /[^\x00-\x7F]/g; 
        let finalFilenameForHeader;

        if (nonAsciiRegex.test(baseNameWithoutExt)) {
            const timestamp = Date.now();
            finalFilenameForHeader = `image_${timestamp}.bmp`;
        } else {
            finalFilenameForHeader = `${baseNameWithoutExt}.bmp`;
        }
        console.log(`[Main] Filename for header: ${finalFilenameForHeader}`);
        
        const tempDir = app.getPath('temp');
        const tempFileName = `processed_${Date.now()}_${path.basename(finalFilenameForHeader)}`;
        tempFilePath = path.join(tempDir, tempFileName); 

        if (originalFileExt === '.bmp') {
            console.log('[Main] Original file is BMP. Attempting to copy directly.');
            const imageForValidation = nativeImage.createFromPath(originalFilePath); 
            if (imageForValidation.isEmpty()) {
                // Even if isEmpty is true, we will still try to copy it, 
                // as the receiving end might be more tolerant or it's a specific type of BMP
                // that nativeImage struggles with but is otherwise valid.
                // The error will be caught by the receiver if it's truly invalid.
                 console.warn(`[Main] Original BMP at ${originalFilePath} could not be loaded reliably by nativeImage (isEmpty is true). Copying as is.`);
            }
            try {
                fs.copyFileSync(originalFilePath, tempFilePath);
                console.log(`[Main] Original BMP copied to temp path: ${tempFilePath}`);
            } catch (copyError) {
                 console.error('[Main] Error copying original BMP file:', copyError);
                return { success: false, error: `复制原始BMP文件失败: ${copyError.message}` };
            }
        } else {
            // For non-BMP files, convert to a standard 24-bit BMP
            console.log(`[Main] Original file is ${originalFileExt}. Converting to TRUE BMP.`);
            const image = nativeImage.createFromPath(originalFilePath); 
            if (image.isEmpty()) {
                return { success: false, error: '无法加载图片（非BMP），文件可能已损坏或格式不支持。' };
            }

            const { width, height } = image.getSize();
            const rawPixelDataBGRA = image.toBitmap(); 

            const BITS_PER_PIXEL = 24;
            const BYTES_PER_PIXEL = BITS_PER_PIXEL / 8;
            const rowSizeWithoutPadding = width * BYTES_PER_PIXEL;
            const paddingPerRow = (4 - (rowSizeWithoutPadding % 4)) % 4;
            const rowSizeWithPadding = rowSizeWithoutPadding + paddingPerRow;
            const pixelDataSize = rowSizeWithPadding * height;
            const dibHeaderSize = 40; 
            const fileHeaderSize = 14;
            const offsetToPixelData = fileHeaderSize + dibHeaderSize;
            const fileSize = offsetToPixelData + pixelDataSize;
            const bmpBuffer = Buffer.alloc(fileSize);

            bmpBuffer.write('BM', 0); 
            bmpBuffer.writeUInt32LE(fileSize, 2); 
            bmpBuffer.writeUInt16LE(0, 6); 
            bmpBuffer.writeUInt16LE(0, 8); 
            bmpBuffer.writeUInt32LE(offsetToPixelData, 10); 
            bmpBuffer.writeUInt32LE(dibHeaderSize, 14); 
            bmpBuffer.writeInt32LE(width, 18); 
            bmpBuffer.writeInt32LE(height, 22); 
            bmpBuffer.writeUInt16LE(1, 26); 
            bmpBuffer.writeUInt16LE(BITS_PER_PIXEL, 28); 
            bmpBuffer.writeUInt32LE(0, 30); 
            bmpBuffer.writeUInt32LE(pixelDataSize, 34); 
            bmpBuffer.writeInt32LE(2835, 38); 
            bmpBuffer.writeInt32LE(2835, 42); 
            bmpBuffer.writeUInt32LE(0, 46); 
            bmpBuffer.writeUInt32LE(0, 50); 
            
            let pixelDataOffset = offsetToPixelData;
            for (let y = height - 1; y >= 0; y--) { 
                for (let x = 0; x < width; x++) {
                    const bgraIndex = (y * width + x) * 4; 
                    bmpBuffer[pixelDataOffset++] = rawPixelDataBGRA[bgraIndex];     // B
                    bmpBuffer[pixelDataOffset++] = rawPixelDataBGRA[bgraIndex + 1]; // G
                    bmpBuffer[pixelDataOffset++] = rawPixelDataBGRA[bgraIndex + 2]; // R
                }
                for (let p = 0; p < paddingPerRow; p++) {
                    bmpBuffer[pixelDataOffset++] = 0;
                }
            }
            fs.writeFileSync(tempFilePath, bmpBuffer);
            console.log(`[Main] Image converted from ${originalFileExt} and saved to temporary TRUE BMP: ${tempFilePath}`);
        }

        return {
            success: true, tempFilePath: tempFilePath, 
            finalFilenameForHeader: finalFilenameForHeader, originalPath: originalFilePath 
        };

    } catch (error) {
        console.error('[Main] Error processing image:', error);
        deleteTempFile(tempFilePath); 
        return { success: false, error: `图片处理失败: ${error.message}` };
    }
});


ipcMain.handle('check-computer-online', async (event, ip, port = 5000) => {
    console.log(`Main: Probing ${ip}:${port}`);
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000); 

        socket.on('connect', () => {
            console.log(`Main: ${ip}:${port} is online.`);
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            console.log(`Main: ${ip}:${port} timed out.`);
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            console.log(`Main: ${ip}:${port} error - ${err.code || err.message}. Assuming offline.`);
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, ip);
    });
});

ipcMain.handle('show-open-directory-dialog', async (event, options) => {
    const activeWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!activeWindow || activeWindow.isDestroyed()) {
        console.error("show-open-directory-dialog: No window available to show dialog.");
        return { canceled: true, filePaths: [] };
    }
    try {
        const result = await dialog.showOpenDialog(activeWindow, options);
        return result;
    } catch (error) {
        console.error("[Main] Error in showOpenDirectoryDialog:", error);
        return { canceled: true, filePaths: [] };
    }
});


function sendSingleImageToIp(imagePathToSend, targetIpForSend, roomNameForLog, imageNameInHeader, targetPort = 5000) {
    return new Promise((resolve, reject) => {
        const filenameBaseForHeader = imageNameInHeader; 
        let client = new net.Socket();
        let promiseSettled = false;
        let senderFinishedWriting = false; 

        const settlePromise = (fn, data) => {
            if (!promiseSettled) {
                promiseSettled = true;
                fn(data);
                if (client && !client.destroyed) client.destroy();
                client = null;
                if (imagePathToSend && imagePathToSend.includes(app.getPath('temp'))) { 
                    if (data.status !== 'error' || (data.message && !data.message.includes('处理后的图片文件不存在'))) {
                         deleteTempFile(imagePathToSend);
                    }
                }
            }
        };

        if (!fs.existsSync(imagePathToSend)) { 
            const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: `处理后的图片文件不存在: ${filenameBaseForHeader}` };
            sendLogToPopup(errData);
            settlePromise(reject, errData);
            return;
        }
        
        client.setTimeout(20000);

        client.on('timeout', () => {
            console.error(`[${targetIpForSend}] Socket 连接或发送超时: ${filenameBaseForHeader}`);
            const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: `操作超时` };
            sendLogToPopup(errData);
            settlePromise(reject, errData);
        });

        client.connect(targetPort, targetIpForSend, () => {
            if (promiseSettled) return;
            console.log(`[${targetIpForSend}] 已连接，准备发送: ${filenameBaseForHeader}`);
            sendLogToPopup({ ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'sending', message: '正在发送头部...' });
            
            const filesize = fs.statSync(imagePathToSend).size; 
            const header = `${filenameBaseForHeader}|${filesize}`.padEnd(1024, " ");
            client.write(header, 'utf-8', () => {
                 if (promiseSettled) return;
                 sendLogToPopup({ ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'sending', message: '正在发送数据...' });
            });

            const fileStream = fs.createReadStream(imagePathToSend); 
            fileStream.on('data', (chunk) => {
                if (promiseSettled || !client || !client.writable) {
                    fileStream.destroy(); return;
                }
                if (!client.write(chunk)) fileStream.pause();
            });
            client.on('drain', () => { if (fileStream.isPaused()) fileStream.resume(); });

            fileStream.on('end', () => {
                if (promiseSettled) return;
                console.log(`[${targetIpForSend}] 文件数据已全部写入socket缓冲区: ${filenameBaseForHeader}`);
                if (client && !client.destroyed) client.end(); 
            });
            fileStream.on('error', (err) => {
                console.error(`[${targetIpForSend}] 读取文件失败: ${filenameBaseForHeader}`, err);
                const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: `读取文件失败: ${err.message}` };
                sendLogToPopup(errData);
                settlePromise(reject, errData);
            });
        });

        client.on('error', (err) => {
            console.error(`[${targetIpForSend}] Socket 错误: ${filenameBaseForHeader}`, err);
            const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: `连接错误: ${err.message}` };
            sendLogToPopup(errData);
            settlePromise(reject, errData);
        });
        
        client.on('finish', () => { 
            senderFinishedWriting = true;
            console.log(`[${targetIpForSend}] Socket 'finish' event: All data written to OS buffer.`);
        });

        client.on('close', (hadError) => {
            console.log(`[${targetIpForSend}] Socket 连接已关闭 (hadError: ${hadError}): ${filenameBaseForHeader}`);
            if (!promiseSettled) {
                if (hadError) {
                    const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: '连接因错误而关闭' };
                    sendLogToPopup(errData);
                    settlePromise(reject, errData);
                } else if (senderFinishedWriting) {
                    const successData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'success', message: `图片 "${filenameBaseForHeader}" 发送完成` };
                    sendLogToPopup(successData);
                    settlePromise(resolve, successData);
                } else {
                    const errData = { ip: targetIpForSend, room: roomNameForLog, image: imageNameInHeader, status: 'error', message: '连接关闭但发送状态未知' };
                    sendLogToPopup(errData);
                    settlePromise(reject, errData);
                }
            }
        });
    });
}


ipcMain.handle('send-image', async (event, { 
    processedPath, 
    filenameForHeader, 
    targetIp, 
    targetComputerList, 
    isRecovery = false, 
    recoveryImagesPath = null 
}) => {
    createLogWindow(); 
    sendLogToPopup({ clearAll: true });

    if (isRecovery) {
        if (!targetComputerList || targetComputerList.length === 0) {
            const errData = { ip: 'N/A', room: '一键恢复', image: 'N/A', status: 'error', message: "没有目标计算机可供恢复。" };
            sendLogToPopup([errData]);
            return [errData];
        }
        if (!recoveryImagesPath) { 
            const errData = { ip: 'N/A', room: '一键恢复', image: 'N/A', status: 'error', message: "未提供恢复图片文件夹路径。" };
            sendLogToPopup([errData]);
             targetComputerList.forEach(comp => sendLogToPopup({ip: comp.ip, room: comp.name, image: 'N/A', status: 'error', message: "未提供恢复图片文件夹"}));
            return targetComputerList.map(comp => ({ip: comp.ip, room: comp.name, image: 'N/A', status: 'error', message: "未提供恢复图片文件夹"}));
        }

        const initialLogs = [];
        targetComputerList.forEach((comp, index) => {
            const recoveryImageName = `${index + 1}.bmp`; 
            initialLogs.push({
                ip: comp.ip, room: comp.name, image: recoveryImageName,
                status: 'sending', message: '等待队列...'
            });
        });
        sendLogToPopup(initialLogs);

        const recoveryPromises = [];
        for (let i = 0; i < targetComputerList.length; i++) {
            const comp = targetComputerList[i];
            const recoveryImageNameForHeader = `${i + 1}.bmp`; 
            const actualRecoveryImagePath = path.join(recoveryImagesPath, recoveryImageNameForHeader); 

            if (!fs.existsSync(actualRecoveryImagePath)) {
                const errData = { ip: comp.ip, room: comp.name, status: 'error', message: `恢复图片 "${recoveryImageNameForHeader}" 未在指定文件夹找到。`, image: recoveryImageNameForHeader };
                sendLogToPopup(errData);
                recoveryPromises.push(Promise.resolve(errData)); 
                continue;
            }
            recoveryPromises.push(
                sendSingleImageToIp(actualRecoveryImagePath, comp.ip, comp.name, recoveryImageNameForHeader) 
                    .catch(errorDetails => errorDetails) 
            );
        }
        return Promise.all(recoveryPromises);

    } else {
        if (!processedPath || !filenameForHeader) { 
            const errData = { ip: targetIp || 'N/A', room: '单点传送', image: 'N/A', status: 'error', message: "图片未正确处理或文件名丢失。" };
            sendLogToPopup([errData]);
            return [errData];
        }
        const computerEntry = targetComputerList ? targetComputerList.find(c => c.ip === targetIp) : null;
        const roomNameForLog = computerEntry ? computerEntry.name : targetIp;
        
        sendLogToPopup([{ ip: targetIp, room: roomNameForLog, image: filenameForHeader, status: 'sending', message: '准备发送...' }]);

        return sendSingleImageToIp(processedPath, targetIp, roomNameForLog, filenameForHeader) 
            .then(result => [result])
            .catch(errorDetails => [errorDetails]);
    }
});

ipcMain.on('open-about-window', () => {
    console.log("[Main] Received request to open about window.");
    createAboutWindow();
});

// Window control IPC handlers
ipcMain.on('close-app', () => { 
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close(); 
    } else {
        app.quit(); 
    }
});
ipcMain.on('minimize-app', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow(); 
    if (focusedWindow && !focusedWindow.isDestroyed() && focusedWindow.isMinimizable()) {
        focusedWindow.minimize();
    } else if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimizable()) { 
        mainWindow.minimize();
    }
});
ipcMain.on('maximize-app', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed() && focusedWindow.isMaximizable()) {
        if (focusedWindow.isMaximized()) {
            focusedWindow.unmaximize();
        } else {
            focusedWindow.maximize();
        }
    } else if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximizable()) { 
         if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});
