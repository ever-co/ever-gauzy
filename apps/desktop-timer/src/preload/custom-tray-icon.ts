import { ipcRenderer } from 'electron';

const HEIGHT = 16;

const ICON_SIZE = 16;
const ICON_AREA_WIDTH = ICON_SIZE;
const TEXT_AREA_WIDTH = 70;
const WIDTH = ICON_AREA_WIDTH + TEXT_AREA_WIDTH;
let activeIcon = '';
let grayIcon = '';
const themeColor = {
	dark: {
		active: {
			bgColor: '#F2F4F7',
			txtColor: '#111827'
		},
		stopped: {
			bgColor: '#D1D5DB',
			txtColor: '#374151'
		}
	},
	light: {
		active: {
			bgColor: '#111827',
			txtColor: '#F9FAFB'
		},
		stopped: {
			bgColor: '#474747',
			txtColor: '#EEF2F6'
		}
	}
}

const selectedTheme: {
	active: {
		bgColor: string;
		txtColor: string;
	},
	stopped: {
		bgColor: string;
		txtColor: string;
	}
} = {
	active: {
		bgColor: '#111827',
		txtColor: '#F9FAFB'
	},
	stopped: {
		bgColor: '#474747',
		txtColor: '#EEF2F6'
	}
}


const ICON_BG_COLOR = '#808080';

const BORDER_RADIUS = 0;  // ← Rounded corners (0 = square)

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;

const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');
bgCanvas.width = WIDTH;
bgCanvas.height = HEIGHT;

let iconImage = null;

function loadIcon(isStopped = true) {
	const selectedIcon = isStopped ? grayIcon : activeIcon;
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			iconImage = img;
			resolve(null);
		};
		img.onerror = () => {
			console.error('Failed to load icon');
			resolve(null);
		};

		// ← Your PNG file path here
		img.src = selectedIcon;
	});
}

function initColor() {
	const theme = detectTheme();
	selectedTheme.active = themeColor[theme].active;
	selectedTheme.stopped = themeColor[theme].stopped;
}

function detectTheme() {
	const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	console.log('theme selected', isDark);
	return isDark ? 'dark' : 'light';
}


function initBackground(isStopped: boolean = true) {
	bgCtx.clearRect(0, 0, WIDTH, HEIGHT);
	let bgColor = isStopped ? selectedTheme.stopped.bgColor : selectedTheme.active.bgColor;

	// Draw full rounded rectangle (text bg color)
	bgCtx.fillStyle = bgColor;
	bgCtx.beginPath();
	bgCtx.roundRect(0, 0, WIDTH, HEIGHT, BORDER_RADIUS);
	bgCtx.fill();

	// Draw icon area background (left side with rounded left corners)
	bgCtx.fillStyle = ICON_BG_COLOR;
	bgCtx.beginPath();
	bgCtx.roundRect(0, 0, ICON_AREA_WIDTH, HEIGHT, [BORDER_RADIUS, 0, 0, BORDER_RADIUS]);
	bgCtx.fill();
}

function renderTime(currentTime?: string,) {
	let timeText: string = '--:--:--';

	if (currentTime) {
		timeText = currentTime;
	}

	let textColor = currentTime ? selectedTheme.active.txtColor : selectedTheme.stopped.txtColor;

	// Draw background
	ctx.drawImage(bgCanvas, 0, 0);

	// Draw PNG icon on the left
	if (iconImage) {
		const iconX = (ICON_AREA_WIDTH - ICON_SIZE) / 2;  // ← Center horizontally
		const iconY = (HEIGHT - ICON_SIZE) / 2;           // ← Center vertically
		ctx.drawImage(iconImage, iconX, iconY, ICON_SIZE, ICON_SIZE);
	}

	// Draw text
	const textX = ICON_AREA_WIDTH + (TEXT_AREA_WIDTH / 2);  // ← Center horizontally
	const textY = (HEIGHT / 2) + 1;
	ctx.fillStyle = textColor;
	ctx.font = '12px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(timeText, textX, textY);

	return canvas.toDataURL('image/png');
}

export function initIpc() {
	ipcRenderer.on('custom_tray_icon', (_, arg) => {
		switch (true) {
			case arg.event === 'stopTimer':
				return stopClock();
			case arg.event === 'updateTheme':
				return updateTheme(arg.isStopped);
			case arg.event === 'initCustomIcon':
				return initTrayIcon();
			case arg.event === 'updateTimer': {
				return updateTime(arg.timeText);
			}
			case arg.event === 'startTimer':
				return startTimer();
			default:
				break;
		}
	});
}

export async function initTrayIcon() {
	initColor();
	const icons = await ipcRenderer.invoke('set-tray-icon');
	setIcon(icons.activeIcon, icons.grayIcon);
	initIpc();
	await loadIcon(true);
	initBackground();
	const dataUrl = renderTime();
	ipcRenderer.send('update-tray-icon', dataUrl);
}

export function updateTime(currentTime: string) {
	const dataUrl = renderTime(currentTime);
	ipcRenderer.send('update-tray-icon', dataUrl);
}

export async function stopClock() {
	await loadIcon(true);
	initBackground(true);
}

export async function startTimer() {
	initColor();
	await loadIcon(false);
	initBackground(false);
}

async function updateTheme(isStopped: boolean) {
	initBackground(isStopped);
	if (isStopped) {
		const dataUrl = renderTime();
		ipcRenderer.send('update-tray-icon', dataUrl);
	}
}

export function setIcon(active: string, stopped: string) {
	activeIcon = active;
	grayIcon = stopped;
}
