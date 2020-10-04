import { app, Menu } from 'electron';
export default class AppMenu {
    constructor() {
        const menu = Menu.buildFromTemplate([
            {
              label: app.getName(),
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                { type: 'separator' },
                { role: 'quit' }
              ]
            },
            {
                label: 'help',
                submenu: [
                    { label: 'Learn More' }
                ]
            }
          ]);
        Menu.setApplicationMenu(menu);
    }
}