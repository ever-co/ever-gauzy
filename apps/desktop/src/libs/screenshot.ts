import { app } from 'electron';
import { writeFileSync } from 'fs';
import moment from 'moment';
import * as url from 'url';
import * as path from 'path';
import { LocalStore } from './getSetStore';
import Form from 'form-data';
import fetch from 'node-fetch';
import { BrowserWindow, screen } from 'electron';

const captureOnlyActiveWindow = async (displays, timeSlotId, activeScreen) => {
	const display = displays.find((x) => x.id === activeScreen.id.toString());
	console.log(display);
	const result = await uploadScreenShot(
		display.img,
		display.name,
		timeSlotId
	);
	return [result];
};

const captureAllWindow = async (displays, timeSlotId, activeScreen) => {
	const result = [];
	await Promise.all(
		displays.map(async (display) => {
			const res = await uploadScreenShot(
				display.img,
				display.name,
				timeSlotId
			);
			if (display.id === activeScreen.id.toString()) {
				result.push({
					...res,
					name: display.name
				});
			}
		})
	);
	return result;
};

const captureSelectedWindow = (displays, idxScreen) => {
	// soon
};

const uploadScreenShot = async (img, name, timeSlotId) => {
	/* start upload */
	const fileName = `screenshot-${moment().format(
		'YYYYMMDDHHmmss'
	)}-${name}.png`;
	try {
		const appInfo = LocalStore.beforeRequestParams();
		const form = new Form();
		form.append('file', Buffer.from(img), {
			contentType: 'image/png',
			filename: fileName
		});
		form.append('timeSlotId', timeSlotId);
		const response = await fetch(
			`${appInfo.apiHost}/api/timesheet/screenshot`,
			{
				method: 'POST',
				body: form,
				headers: {
					Authorization: `Bearer ${appInfo.token}`
				}
			}
		);
		const res = await response.json();
		return res;
	} catch (e) {
		console.log('upload error', e);
		// write file on local directory if upload got error
		const localImg = writeScreenshotLocally(img, fileName);
		return {
			thumbUrl: localImg
		};
	}
};

const writeScreenshotLocally = (img, fileName) => {
	const imgLocation = app.getPath('userData');
	writeFileSync(`${imgLocation}/${fileName}`, img);
	return `${imgLocation}/${fileName}`;
};

const detectActiveWindow = () => {
	const allScreen = screen.getAllDisplays();
	const cursorPosition = screen.getCursorScreenPoint();
	const currentPosition = allScreen.find((item) => {
		if (
			cursorPosition.x >= item.bounds.x &&
			cursorPosition.x <= item.bounds.width + item.bounds.x
		) {
			return item;
		}
	});
	return currentPosition;
};

const showCapturedToRenderer = (
	timeTrackerWindow,
	NotificationWindow,
	timeSlotId,
	thumbUrl
) => {
	const sizes = screen.getPrimaryDisplay().size;
	timeTrackerWindow.webContents.send('show_last_capture', {
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
	};

	NotificationWindow = new BrowserWindow({
		...screenCaptureWindow,
		x: sizes.width - (screenCaptureWindow.width + 15),
		y: 0 + 15
	});
	const urlpath = url.format({
		pathname: path.join(__dirname, '../ui/index.html'),
		protocol: 'file:',
		slashes: true,
		hash: '/screen-capture'
	});
	NotificationWindow.loadURL(urlpath);
	NotificationWindow.hide();

	setTimeout(() => {
		NotificationWindow.show();
		NotificationWindow.webContents.send('show_popup_screen_capture', {
			imgUrl: thumbUrl
		});
	}, 1000);
	setTimeout(() => {
		NotificationWindow.close();
	}, 6000);
};

export async function takeshot(timeTrackerWindow, arg, NotificationWindow) {
	try {
		const displays = arg.screens;
		const appSetting = LocalStore.getStore('appSetting');
		let captured = null;
		const activeWindow = detectActiveWindow();
		switch (appSetting.monitor.captured) {
			case 'all':
				captured = await captureAllWindow(
					displays,
					arg.timeSlotId,
					activeWindow
				);
				break;
			case 'active-only':
				captured = await captureOnlyActiveWindow(
					displays,
					arg.timeSlotId,
					activeWindow
				);
				break;
			default:
				break;
		}

		// show to render
		showCapturedToRenderer(
			timeTrackerWindow,
			NotificationWindow,
			arg.timeSlotId,
			captured[0].thumbUrl
		);
	} catch (error) {
		console.log('error scree', error);
	}
}
