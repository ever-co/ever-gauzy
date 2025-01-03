import { BrowserWindow } from 'electron';
import { ApiService, UiService } from './server';

export class DesktopServerFactory {
	private static uiInstance: UiService;
	private static apiInstance: ApiService;

	public static getUiInstance(
		path?: string,
		env?: any,
		win?: BrowserWindow,
		signal?: AbortSignal,
		port?: number
	): UiService {
		if (!this.uiInstance && !!path && !!env && !!win && !!port) {
			this.uiInstance = new UiService(path, env, win, signal, port);
		}
		return this.uiInstance;
	}

	public static getApiInstance(path?: string, env?: any, win?: BrowserWindow, signal?: AbortSignal): ApiService {
		if (!this.apiInstance && !!path && !!env && !!win) {
			this.apiInstance = new ApiService(path, env, win, signal);
		}
		return this.apiInstance;
	}
}
