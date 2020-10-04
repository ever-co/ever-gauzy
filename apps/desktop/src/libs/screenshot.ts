import { app } from 'electron';
import { writeFileSync } from 'fs';
import moment from 'moment';
import * as url from 'url';
import * as path from 'path';
import { LocalStore } from './getSetStore';
import Form from 'form-data';
import fetch from 'node-fetch';
import { BrowserWindow, screen } from 'electron';
import screenshot from 'screenshot-desktop';

const captureOnlyActiveWindow = async (displays, timeSlotId, activeScreen) => {
	const display = displays.find((x) => x.id === activeScreen.id.toString());
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

const uploadScreenShot = async (img, name, timeSlotId) => {
	/* start upload */
	const fileName = `screenshot-${moment().format(
		'YYYYMMDDHHmmss'
	)}-${name}.png`;
	try {
		const appInfo = LocalStore.beforeRequestParams();
		const form = new Form();
		const bufferImg = Buffer.isBuffer(img) ? img : Buffer.from(img);
		form.append('file', bufferImg, {
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
	let idx = null;
	const currentPosition = allScreen.find((item, i) => {
		if (
			cursorPosition.x >= item.bounds.x &&
			cursorPosition.x <= item.bounds.width + item.bounds.x
		) {
			idx = i;
			return item;
		}
	});
	return {...currentPosition, index: idx};
};

const showCapturedToRenderer = (
	timeTrackerWindow,
	NotificationWindow,
	timeSlotId,
	thumbUrl,
	quitApp
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
		if (quitApp) app.quit();
	}, 4000);
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
			captured[0].thumbUrl,
			arg.quitApp
		);
		
	} catch (error) {
		console.log('error upload', error);
	}
}

// method using screenshot-desktop lib
export async function captureScreen(timeTrackerWindow, notificationWindow, timeSlotId, quitApp) {
	try {
		const displays = await screenshot.listDisplays();
		const activeWindow = detectActiveWindow();
		const allDisplays = [];
		await Promise.all(displays.map(async (display, i) => {
			const img = await screenshot({ screen: display.id});
			allDisplays.push({
				img: img,
				name: `Screen ${i}`,
				id: i === activeWindow.index ? activeWindow.id.toString() : display.id
			})
		}))
		takeshot(timeTrackerWindow, {
			timeSlotId: timeSlotId,
			screens: allDisplays,
			quitApp
		}, notificationWindow);
	} catch (error) {
		console.log('error', error);
	}
}
