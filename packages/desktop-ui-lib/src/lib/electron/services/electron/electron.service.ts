import { inject, Injectable, NgZone } from '@angular/core';
import * as remote from '@electron/remote';
import { desktopCapturer, ipcRenderer, shell } from 'electron';
import { from, Observable, throwError } from 'rxjs';

@Injectable()
export class ElectronService {
	private readonly ngZone = inject(NgZone);
	ipcRenderer: typeof ipcRenderer;
	remote: typeof remote | any;
	desktopCapturer: typeof desktopCapturer;
	shell: typeof shell;

	/**
	 * Checks if the application is running in the Electron environment.
	 */
	get isElectron(): boolean {
		return !!(window && (window as any).process && (window as any).process.type);
	}

	get isContextBridge(): boolean {
		return !!(window && (window as any).electronAPI);
	}

	constructor() {
		// Conditional imports because we only want to load modules inside Electron App
		if (this.isElectron) {
			// Previously we used that class to on-demand load the electron-log module, but now we load it in the header of this file.
			// Still we want to keep that way to "require" it for now
			this.ipcRenderer = window.require('electron').ipcRenderer;
			this.remote = window.require('@electron/remote');
			this.shell = window.require('electron').shell;
		} else if (this.isContextBridge) {
			const electronAPI = (window as any).electronAPI;
			this.ipcRenderer = electronAPI.ipcRenderer;
			this.remote = electronAPI.remote;
			this.shell = electronAPI.shell;
		}
		this.desktopCapturer = {
			getSources: async (opts) => await this.ipcRenderer?.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
		};
	}

	/**
	 * Create an Observable from an Electron IPC channel
	 */
	public fromEvent<T>(channel: string): Observable<T> {
		return new Observable((subscriber) => {
			if (!this.isElectron && !this.isContextBridge) {
				subscriber.error(new Error('Electron API is not available'));
				return;
			}

			const handler = (_: Electron.IpcRendererEvent, ...args: any[]) => {
				this.ngZone.run(() => {
					if (args.length === 1) {
						subscriber.next(args[0]);
					} else {
						subscriber.next(args as T);
					}
				});
			};

			this.ipcRenderer.on(channel, handler);

			// Cleanup function
			return () => this.ipcRenderer.removeListener(channel, handler);
		});
	}

	/**
	 * Invoke an Electron IPC handler with type-safe arguments and return value
	 */
	public invoke<T = unknown, U = unknown>(channel: string, data?: T): Promise<U> {
		if (!this.isElectron && !this.isContextBridge) {
			return Promise.reject(new Error('Electron API is not available'));
		}

		return this.ipcRenderer.invoke(channel, data);
	}

	/**
	 * Observable-based version of invoke
	 */
	public invoke$<T = unknown, U = unknown>(channel: string, data?: T): Observable<U> {
		if (!this.isElectron && !this.isContextBridge) {
			return throwError(() => new Error('Electron API is not available'));
		}

		return from(this.invoke<T, U>(channel, data));
	}

	/**
	 * Remove all listeners for a channel
	 */
	public removeAllListeners(channel: string): void {
		if (!this.isElectron && !this.isContextBridge) {
			return;
		}

		this.ipcRenderer.removeAllListeners(channel);
	}
}
