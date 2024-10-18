import { CustomTitlebar, TitlebarColor } from "custom-electron-titlebar";
import { nativeImage, ipcRenderer } from 'electron';
import * as path from 'path';
let contentInterval;
const getElementByXpath = (path) => {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
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

    ipcRenderer.on('hide-menu', () => {
        titleBar.dispose();
    })

    ipcRenderer.on('adjust_view', () => {
        clearInterval(contentInterval);
        const headerIcon = '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/div/nb-sidebar[1]/div/div/div';
        const headerCompany = '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/div/nb-sidebar[2]/div/div/div/div[1]/div';
        const header = '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/nb-layout-header/nav/ngx-header/div/div[2]'

        contentInterval = setInterval(() => {
            const elHeaderIcon: any = getElementByXpath(headerIcon);
            const elHeaderCompany: any = getElementByXpath(headerCompany);
            const elHeader: any = getElementByXpath(header);
            if (elHeaderIcon) {
                elHeaderIcon.style.marginTop = '30px';
                clearInterval(contentInterval);
            }
            if (elHeaderCompany) {
                elHeaderCompany.style.marginTop = '30px';
                clearInterval(contentInterval);
            }

            if (elHeader) {
                elHeader.style.marginTop = '20px';
                clearInterval(contentInterval);
            }
        }, 1000)
    });

    const overStyle = document.createElement('style');
    overStyle.innerHTML = `
        .cet-container {
            top:0px !important;
			overflow: unset !important;
        }
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

        .cet-menubar-menu-container .cet-action-menu-item {
            -ms-flex: 1 1 auto;
            flex: 1 1 auto;
            display: -ms-flexbox;
            display: flex;
            height: 2.231em;
            margin: 0px 0px;
            align-items: center;
            position: relative;
            border-radius: 4px;
            text-decoration: none;
        }

        .cet-menubar .cet-menubar-menu-button {
            box-sizing: border-box;
            padding: 0px 5px;
            height: 100%;
            cursor: default;
            zoom: 0.98;
            white-space: nowrap;
            -webkit-app-region: no-drag;
            outline: 0;
        }



    `;
    document.head.appendChild(overStyle);
});
