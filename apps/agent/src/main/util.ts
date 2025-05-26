import * as path from 'path';
import { environment } from '../environments/environment';
import { LocalStore } from '@gauzy/desktop-lib';
import { screen } from 'electron';

export type TAuthConfig = {
	user: {
		employee: {
			tenantId: string;
			organizationId: string;
			employeeId: string
		}
		id: string
	};
	token: string;
}

export type TAppSetting = {
	monitor?: {
		captured?: string
	},
	timer: {
		updatePeriod: number
	},
	screenshotNotification: boolean,
	simpleScreenshotNotification: boolean,
	kbMouseTracking: boolean
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


