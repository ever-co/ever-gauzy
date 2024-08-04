import { CustomTitlebar, TitlebarColor } from "custom-electron-titlebar";
import { nativeImage, ipcRenderer } from 'electron';
import * as path from 'path';
window.addEventListener('DOMContentLoaded', async () => {
    // Title bar implementation
    const appPath = await ipcRenderer.invoke('get-app-path');
    const titleBar = new CustomTitlebar({
        icon: nativeImage.createFromPath(path.join(appPath, 'assets', 'icons', 'tray', 'icon.png')),
        backgroundColor: TitlebarColor.fromHex('#1f1f1f'),
        enableMnemonics: false,
        iconSize: 16,
        maximizable: false,
        menuPosition: 'left',
        menuTransparency: 0.2
    })
    ipcRenderer.on('refresh_menu', () => {
        titleBar.refreshMenu();
    });

    const overStyle = document.createElement('style');
    overStyle.innerHTML = `
        .cet-menubar-menu-container {
            position: absolute;
            display: block;
            left: 0px;
            opacity: 1;
            outline: 0;
            text-align: left;
            margin: 0 auto;
            margin-left: 0;
            font-size: inherit;
            overflow-x: visible;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-end;
            white-space: nowrap;
            border-radius: 5px;
            backdrop-filter: blur(10px);
            box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12);
            z-index: 99999;
            min-width: 130px;
            border: solid 1px rgba(255, 255, 255, 0.5);
        }
    `;
    document.head.appendChild(overStyle);
});
