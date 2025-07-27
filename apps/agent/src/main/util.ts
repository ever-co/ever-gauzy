import * as path from 'path';
import { environment } from '../environments/environment';
import { LocalStore } from '@gauzy/desktop-lib';
import { screen } from 'electron';
import { CONSTANT } from '../constant';

export type TAuthConfig = {
	user: {
		employee: Record<string, unknown> & {
			tenantId?: string;
			organizationId?: string;
			id?: string;
		}
		id: string
	};
	token: string;
}

export type TEmployeeResponse = {
	id: string,
	allowScreenshotCapture: boolean,
	allowAgentAppExit: boolean,
	allowLogoutFromAgentApp: boolean,
	trackKeyboardMouseActivity: boolean,
	trackAllDisplays: boolean
}


export type TAppSetting = {
	monitor: {
		captured: 'all' | 'active-only';
	},
	timer: {
		updatePeriod: 1 | 5 | 10
	},
	screenshotNotification: boolean,
	simpleScreenshotNotification: boolean,
	kbMouseTracking: boolean,
	allowAgentAppExit: boolean,
	allowLogoutFromAgentApp: boolean,
	allowScreenshotCapture: boolean
}

export type TInitialConfig = {
	isSetup: boolean
}

export function resolveHtmlPath(htmlFileName: string, hash: string) {
	if (process.env.NODE_ENV === 'development') {
		const port = process.env.PORT || 4200;
		return `http://localhost:${port}#/${hash}`;
	}

	const pathUrl = path.resolve(__dirname, '..', `${htmlFileName}`);
	return pathUrl;
}

export function getApiBaseUrl(configs: {
	serverUrl?: string,
	port?: number
} | { [key: string]: string }) {
	if (configs?.serverUrl) return configs.serverUrl;
	else {
		return configs?.port
			? `http://localhost:${configs?.port}`
			: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

export function delaySync(duration: number) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(true), duration);
	});
}

export function getAuthConfig(): TAuthConfig {
	const auth: TAuthConfig = LocalStore.getStore('auth');
	return auth;
}

export function getScreen() {
	const displays = screen.getAllDisplays();
	const cursor = screen.getCursorScreenPoint();

	const currentDisplay = displays.find(display => {
		const { x, y, width, height } = display.bounds;
		return cursor.x >= x && cursor.x <= x + width &&
			cursor.y >= y && cursor.y <= y + height;
	});

	if (!currentDisplay) {
		// Fallback to primary monitor to keep the agent running
		const primary = screen.getPrimaryDisplay();
		return {
			activeWindow: { id: primary.id },
			screenSize: primary.workAreaSize
		};
	}

	// const displayIndex = displays.indexOf(currentDisplay);
	return {
		activeWindow: { id: currentDisplay.id },
		screenSize: screen.getPrimaryDisplay().workAreaSize
	}
}

export function getAppSetting(): Partial<TAppSetting> {
	const appConfig = (LocalStore.getStore('appSetting') ?? {}) as Partial<TAppSetting>;
	return appConfig;
}

export function getInitialConfig(): Partial<TInitialConfig> {
	const initialConfig = (LocalStore.getStore('configs') ?? {}) as Partial<TInitialConfig>;
	return initialConfig;
}

export function getScreenshotSoundPath():string {
	if (process.env.NODE_ENV === 'development') {
		return path.join(__dirname, '..', 'data', 'sound', 'snapshot-sound.wav');
	}
	return path.join(process.resourcesPath, 'data', 'sound', 'snapshot-sound.wav');
}

export function getTrayIcon(): string {
	return path.join(__dirname, '..', CONSTANT.TRAY_ICON_PATH)
}

export function updateAgentSetting(employee: Partial<TEmployeeResponse>) {
	const appSetting: Partial<TAppSetting> = {
		allowAgentAppExit: employee.allowAgentAppExit,
		allowLogoutFromAgentApp: employee.allowLogoutFromAgentApp,
		monitor: {
			captured: employee.trackAllDisplays ? 'all' : 'active-only'
		},
		kbMouseTracking: employee.trackKeyboardMouseActivity,
		allowScreenshotCapture: employee.allowScreenshotCapture ?? false
	}
	LocalStore.updateApplicationSetting(appSetting);
}
