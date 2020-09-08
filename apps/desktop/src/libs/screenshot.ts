import { app } from 'electron';
import screenshot from 'screenshot-desktop';
import { writeFileSync, createReadStream, unlinkSync} from 'fs';
import moment from 'moment';
import * as url from 'url';
import * as path from 'path';
import { LocalStore } from './getSetStore';
import Form from 'form-data';
import fetch from 'node-fetch';
import { BrowserWindow, screen } from 'electron';
export async function takeshot(win3, timeSlotId, win4) {
    try {
        const displays = await screenshot.listDisplays();
        const sizes = screen.getPrimaryDisplay().size;
        const allScreen = screen.getAllDisplays();
        const cursorPosition = screen.getCursorScreenPoint();
        const currentPosition = allScreen.findIndex((item) => {
            if (cursorPosition.x >= item.bounds.x && cursorPosition.x <= (item.bounds.width + item.bounds.x)) {
                return item;
            }
        })
        const img = await screenshot({ screen: displays[currentPosition].id });
        const imgName = `screenshot-${moment().format('YYYYMMDDHHmmss')}.png`;
        const imgLocation = app.getPath('userData');
        const appInfo = LocalStore.beforeRequestParams();
        const form = new Form();
        form.append('file', img, {
            contentType: 'image/png',
            filename: imgName,
          });
        form.append('timeSlotId', timeSlotId);
        try {
            const test = await fetch(`${appInfo.apiHost}/api/timesheet/screenshot`, {
                method: 'POST',
                body: form,
                headers: {
                    'Authorization': `Bearer ${appInfo.token}`
                }
            })
            const res = await test.json();
            // unlinkSync(`${imgLocation}/${imgName}`);
            win3.webContents.send('show_last_capture', {
                ...LocalStore.beforeRequestParams(),
                timeSlotId: timeSlotId
            });

            // preparing window screenshot
            const screenCaptureWindow = {
                width: 350,
                height: 230,
                frame: false,
                webPreferences: {
                    nodeIntegration: true,
                    webSecurity: false
                }
            }
            

            win4 = new BrowserWindow({
                ...screenCaptureWindow,
                x: sizes.width - (screenCaptureWindow.width + 15),
                y: 0 + 15,
                
            });
            const urlpath = url.format({
                pathname: path.join(__dirname, '../ui/index.html'),
                protocol: 'file:',
                slashes: true,
                hash: '/screen-capture'
            });
            win4.loadURL(urlpath)
            win4.hide();
            // win4.webContents.openDevTools();
            setTimeout(() => {
                win4.show();
                win4.webContents.send('show_popup_screen_capture', {
                    imgUrl: res.thumbUrl
                })
            }, 1000);
            setTimeout(() => {
                win4.close();
            }, 6000);
        } catch (error) {
            // store to local data if upload failed
            writeFileSync(`${imgLocation}/${imgName}`, img);
            console.log('upload error', error);
        }
    } catch (error) {
        console.log('error scree', error);
    }
}