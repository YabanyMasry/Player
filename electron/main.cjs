const { app, BrowserWindow, ipcMain, dialog } = require('electron');

// ... existing code in main.cjs ...

// Added listener at the bottom
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) { return null; }
  return filePaths[0];
});
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function startBackendServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  console.log('[Electron] Starting local Express backend at:', serverPath);
  
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: '4174',
      VITE_PLAYER_MODE: app.isPackaged ? 'local' : (process.env.VITE_PLAYER_MODE || 'local'),
    },
    silent: false,
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend server:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless UI
    backgroundColor: '#000000',
    icon: path.join(__dirname, '..', 'src', 'assets', 'Vinyl.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Check if we are bundled or developing
  if (app.isPackaged) {
    // In production, the local Express server handles serving the static Vite react app at port 4174
    mainWindow.loadURL('http://localhost:4174');
  } else {
    // In development, we watch Vite's hot-reloaded port
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start server then wait a second before opening window to ensure port 4174 binding
  startBackendServer();
  
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[Electron] Killing child Express server...');
    serverProcess.kill();
  }
});

// IPC listeners for the custom React titlebar
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
