import {
    ipcMain,
    BrowserWindow,
} from 'electron';
import { LocalStore } from './desktop-store';
export class DesktopThemeListener {
    private desktopWindow: {
        gauzyWindow?: BrowserWindow;
        timeTrackerWindow?: BrowserWindow;
        imageViewerWindow?: BrowserWindow;
        splashScreenWindow?: BrowserWindow;
        settingsWindow?: BrowserWindow;
        setupWindow?: BrowserWindow;
        updaterWindow?: BrowserWindow;
        popupWindow?: BrowserWindow;
        alwaysOnWindow?: BrowserWindow;
    } = {}
    constructor(
        desktopWindow: {
            gauzyWindow?: BrowserWindow;
            timeTrackerWindow?: BrowserWindow;
            imageViewerWindow?: BrowserWindow;
            splashScreenWindow?: BrowserWindow;
            settingsWindow?: BrowserWindow;
            setupWindow?: BrowserWindow;
            updaterWindow?: BrowserWindow;
            popupWindow?: BrowserWindow;
            alwaysOnWindow?: BrowserWindow;
        }
    ) {
        this.desktopWindow = desktopWindow;
    }

    public listen() {
        ipcMain.removeAllListeners('THEME_CHANGE');
        ipcMain.on('THEME_CHANGE', async (_, theme) => {
            LocalStore.updateApplicationSetting({ theme });
            if (this.desktopWindow.gauzyWindow) {
                this.desktopWindow.gauzyWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.timeTrackerWindow) {
                this.desktopWindow.timeTrackerWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.imageViewerWindow) {
                this.desktopWindow.imageViewerWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.splashScreenWindow) {
                this.desktopWindow.splashScreenWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.settingsWindow) {
                this.desktopWindow.settingsWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.setupWindow) {
                this.desktopWindow.setupWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.updaterWindow) {
                this.desktopWindow.updaterWindow.webContents.send('THEME_CHANGE', theme);
            }
            if (this.desktopWindow.alwaysOnWindow) {
                this.desktopWindow.alwaysOnWindow.webContents.send('THEME_CHANGE', theme);
            }
        });
    }
}
