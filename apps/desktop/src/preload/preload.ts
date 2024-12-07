import { CustomTitlebar, TitlebarColor } from "custom-electron-titlebar";
import { nativeImage, ipcRenderer } from 'electron';
import * as path from 'path';

let contentInterval;

/**
 * Retrieves a single DOM element based on the specified XPath expression.
 *
 * @param {string} path - The XPath expression to locate the desired element.
 * @returns {Node | null} - The first matching DOM node, or `null` if no match is found.
 */
const getElementByXpath = (path) => {
    // Use the `document.evaluate` method to evaluate the XPath expression.
    // The evaluation is performed in the context of the current `document`.
    const result = document.evaluate(
        path, // XPath expression
        document, // Context node (root document in this case)
        null, // Namespace resolver (null for default)
        XPathResult.FIRST_ORDERED_NODE_TYPE, // Return type to get the first matching node
        null // Existing XPathResult to reuse (null to create a new one)
    );

    // Retrieve the single matching node value from the result
    return result.singleNodeValue;
};

/**
 * Adjusts the layout by adding top margins to specific elements.
 */
const adjustView = () => {
    const headerIconPath =
        '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/div/nb-sidebar[1]/div/div/div';
    const headerCompanyPath =
        '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/div/nb-sidebar[2]/div/div/div/div[1]/div';
    const headerPath =
        '/html/body/div[2]/ga-app/ngx-pages/ngx-one-column-layout/nb-layout/div[1]/div/nb-layout-header/nav/ngx-header/div/div[2]';

    contentInterval = setInterval(() => {
        const elements = [
            { element: getElementByXpath(headerIconPath), marginTop: '30px' },
            { element: getElementByXpath(headerCompanyPath), marginTop: '30px' },
            { element: getElementByXpath(headerPath), marginTop: '20px' },
        ];

        for (const { element, marginTop } of elements) {
            if (element instanceof HTMLElement) {
                element.style.marginTop = marginTop;
                clearInterval(contentInterval);
            }
        }
    }, 1000);
};

/**
 * Listens for the DOMContentLoaded event to ensure the DOM is fully loaded
 * before initializing the custom title bar and attaching styles or event listeners.
 */
window.addEventListener('DOMContentLoaded', async () => {
    /**
	 * Fetches the application's base path from the Electron main process using IPC.
	 *
	 * The `get-app-path` event must be handled in the Electron main process to return
	 * the application directory path.
	 *
	 * @returns {Promise<string>} The base path of the application.
	 */
	const appPath = await ipcRenderer.invoke('get-app-path');

	/**
	 * Initializes a custom title bar using the `custom-electron-titlebar` library.
	 *
	 * - Adds a custom icon for the application window.
	 * - Sets background color, menu behavior, and other title bar configurations.
	 *
	 * @param {string} iconPath - The path to the icon file.
	 */
    const titleBar = new CustomTitlebar({
        icon: nativeImage.createFromPath(path.join(appPath, 'assets', 'icons', 'tray', 'icon.png')),
        backgroundColor: TitlebarColor.fromHex('#1f1f1f'),
        enableMnemonics: false,
        iconSize: 16,
        maximizable: false,
        menuPosition: 'left',
        menuTransparency: 0.2
    })

	/**
	 * Listens for the `refresh_menu` event from the main process and refreshes the
	 * menu in the custom title bar. This allows dynamic updates to the menu items.
	 */
	ipcRenderer.on('refresh_menu', () => titleBar.refreshMenu());

	/**
	 * Listens for the `hide-menu` event from the main process and disposes of the
	 * custom title bar to remove it from the window.
	 */
	ipcRenderer.on('hide-menu', () => titleBar.dispose());

	/**
	 * Listens for the `adjust_view` event from the main process and adjusts the layout
	 */
	ipcRenderer.on('adjust_view', adjustView);

	/**
	 * Creates and appends a `<style>` element to the document's `<head>`, applying
	 * custom CSS rules for the custom title bar.
	 *
	 * @property {HTMLStyleElement} overStyle - The `<style>` element containing the CSS rules.
	 */
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
