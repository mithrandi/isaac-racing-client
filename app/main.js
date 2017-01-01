/*
    Racing+ Client
    for The Binding of Isaac: Afterbirth+
    (main process)
*/

// Log file location:
// %APPDATA%\..\Local\Programs\Racing+.log
// %APPDATA%\\..\Local\Programs\Racing+.log (for copy pasting into Discord)

// Build with:
// npm run dist --python="C:\Python27\python.exe"
// npm run dist2 --python="C:\Python27\python.exe" (for uploading to GitHub)

// Reinstall NPM dependencies:
// (ncu only properly updates the package.json, so it has to be blown away and reinstalled entirely)
// (ncu needs to be done in both the root and the app subdirectory)
// ncu -a && rm -rf node_modules && cd app && ncu -a && rm -rf node_modules && cd .. && npm install --python="C:\Python27\python.exe"

'use strict';

// Imports
const electron       = require('electron');
const app            = electron.app;
const BrowserWindow  = electron.BrowserWindow;
const ipcMain        = electron.ipcMain;
const globalShortcut = electron.globalShortcut;
const execFile       = require('child_process').execFile;
const fs             = require('fs');
const os             = require('os');
const path           = require('path');
var autoUpdater; // Filled in later because it throws errors in a development environment
const isDev          = require('electron-is-dev');
const Raven          = require('raven');
const teeny          = require('teeny-conf');

// Constants
const assetsFolder = path.resolve(process.execPath, '..', '..', '..', '..', 'app', 'assets');
const logFile      = (isDev ? 'Racing+.log' : path.resolve(process.execPath, '..', '..', 'Racing+.log'));

// Global variables
var mainWindow; // Keep a global reference of the window object (otherwise the window will be closed automatically when the JavaScript object is garbage collected)
var checkForUpdates = true;

/*
    Logging (code duplicated between main and renderer because of require/nodeRequire issues)
*/

const log = require('tracer').console({
    format: "{{timestamp}} <{{title}}> {{file}}:{{line}}\r\n{{message}}",
    dateformat: "ddd mmm dd HH:MM:ss Z",
    transport: function(data) {
        // #1 - Log to the JavaScript console
        console.log(data.output);

        // #2 - Log to a file
        fs.appendFile(logFile, data.output + '\n', function(err) {
            if (err) {
                throw err;
            }
        });
    }
});

// Get the version
let packageFileLocation = path.join(__dirname, 'package.json');
let packageFile = fs.readFileSync(packageFileLocation, 'utf8');
let version = 'v' + JSON.parse(packageFile).version;
log.info('Racing+ client', version, 'started!');

// Raven (error logging to Sentry)
Raven.config('https://0d0a2118a3354f07ae98d485571e60be@sentry.io/124813', {
    autoBreadcrumbs: true,
    release: version,
    environment: (isDev ? 'development' : 'production'),
    dataCallback: function(data) {
        log.error(data.exception.values);
    },
}).install();

/*
    Subroutines
*/

function createWindow() {
    // Create the browser window
    let width = 1110;
    let height = 720;
    if (isDev) {
        width += 500;
    }
    mainWindow = new BrowserWindow({
        width:  width,
        height: height,
        icon:   path.resolve(assetsFolder, 'img', 'favicon.png'),
        title:  'Racing+',
        frame:  false,
    });
    if (isDev === true) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // Remove the taskbar flash state (this isn't currently used)
    mainWindow.once('focus', function() {
        mainWindow.flashFrame(false);
    });

    // Dereference the window object when it is closed
    mainWindow.on('closed', function() {
        mainWindow = null;
    });
}

function autoUpdate() {
    // Now that the window is created, check for updates
    if (checkForUpdates === true && isDev === false) {
        // Import electron-builder's autoUpdater as opposed to the generic electron autoUpdater (https://github.com/electron-userland/electron-builder/wiki/Auto-Update)
        // (We don't import this at the top because it will throw errors in a development environment)
        autoUpdater = require('electron-auto-updater').autoUpdater;

        autoUpdater.on('error', function(err) {
            log.error(err.message);
            Raven.captureException(err);
            mainWindow.webContents.send('autoUpdater', 'error');
        });

        autoUpdater.on('checking-for-update', function() {
            mainWindow.webContents.send('autoUpdater', 'checking-for-update');
        });

        autoUpdater.on('update-available', function() {
            mainWindow.webContents.send('autoUpdater', 'update-available');
        });

        autoUpdater.on('update-not-available', function() {
            mainWindow.webContents.send('autoUpdater', 'update-not-available');
        });

        autoUpdater.on('update-downloaded', function(e, notes, name, date, url) {
            mainWindow.webContents.send('autoUpdater', 'update-downloaded');
        });

        log.info('Checking for updates.');
        autoUpdater.checkForUpdates();
    }
}

function registerKeyboardHotkeys() {
    // Register global hotkeys
    const hotkeyIsaacFocus = globalShortcut.register('Alt+1', function() {
        let command = path.join(__dirname, '/assets/programs/isaacFocus/isaacFocus.exe');
        execFile(command);
    });
    if (!hotkeyIsaacFocus) {
        log.warn('Alt+1 hotkey registration failed.');
    }

    const hotkeyRacingPlusFocus = globalShortcut.register('Alt+2', function() {
        mainWindow.focus();
    });
    if (!hotkeyRacingPlusFocus) {
        log.warn('Alt+2 hotkey registration failed.');
    }

    const hotkeyReady = globalShortcut.register('Alt+R', function() {
        mainWindow.webContents.send('hotkey', 'ready');
    });
    if (!hotkeyReady) {
        log.warn('Alt+R hotkey registration failed.');
    }

    const hotkeyQuit = globalShortcut.register('Alt+Q', function() {
        mainWindow.webContents.send('hotkey', 'quit');
    });
    if (!hotkeyQuit) {
        log.warn('Alt+Q hotkey registration failed.');
    }
}

/*
    Application handlers
*/

// Check to see if the application is already open
if (isDev === false) {
    const shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        // A second instance of the program was opened, so just focus the existing window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
    if (shouldQuit) {
        app.quit();
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createWindow();
    autoUpdate();
    registerKeyboardHotkeys();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('will-quit', function() {
    globalShortcut.unregisterAll();
});

/*
    IPC handlers
*/

ipcMain.on('asynchronous-message', function(event, arg) {
    log.info('Main process recieved message:', arg);
    if (arg === 'minimize') {
        mainWindow.minimize();
    } else if (arg === 'maximize') {
        if (mainWindow.isMaximized() === true) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    } else if (arg === 'close') {
        app.quit();
    } else if (arg === 'restart') {
        app.relaunch();
        app.quit();
    } else if (arg === 'quitAndInstall') {
        autoUpdater.quitAndInstall();
    }
});
