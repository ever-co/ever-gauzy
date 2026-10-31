import { LocalStore } from '../desktop-store';
import { IServerConfig, IReadWriteFile, IServerSetting } from '../interfaces';
import { resolveDesktopListenHost, toDesktopClientUrl } from './desktop-listen-host';
import { applyUiRuntimeConfig } from './ui-runtime-config';

export class ServerConfig implements IServerConfig {
	private _readWriteFile: IReadWriteFile;

	constructor(readWrite?: IReadWriteFile) {
		this._readWriteFile = readWrite;
	}

	/**
	 * Writes the web UI's runtime configuration (the API URL it calls) into its `index.html` when the install
	 * directory is writable, as before. It is a fallback: the UI server inserts the same script as it serves the file
	 * (see `ui-runtime-config.ts`), so a directory the app cannot write to (a .deb under `/opt`, an AppImage) is skipped
	 * with a warning instead of failing the start (#7735), and no other error here stops the server either.
	 */
	public update(): void {
		if (!this._readWriteFile) return;

		try {
			const fileContent = this._readWriteFile.read();

			if (typeof fileContent !== 'string') {
				console.warn(
					'The web UI directory is not writable: its index.html is left as it is, and the UI server adds the API URL as it serves it.'
				);
				return;
			}

			const updatedContent = applyUiRuntimeConfig(fileContent, this.apiUrl);

			// An unchanged URL leaves the file untouched.
			if (updatedContent !== fileContent) {
				this._readWriteFile.write(updatedContent);
			}
		} catch (error) {
			console.error('Cannot update initial Server file', error);
		}
	}

	public get apiPort(): number {
		return Number(this.setting?.port) || 3000;
	}

	public get uiPort(): number {
		return Number(this.setting?.portUi) || 4200;
	}

	public get uiHostName(): string {
		const defaultHost = 'http://0.0.0.0';

		const host = !this.setting?.host
			? defaultHost
			: this.setting.host.startsWith('http')
				? this.setting.host
				: `http://${this.setting.host}`;

		// The default host is a listen address, not one a client can open. It used to become the
		// loopback address on Windows only; the API may now listen on the loopback address alone, so
		// every platform's URLs (API_BASE_URL, the web UI's API URL, "open in browser") point there.
		// With LAN access off the server apps listen on the loopback address only, so a LAN host typed
		// in the setting points there too (the setting is kept for when LAN access is turned back on).
		// Gauzy Desktop's integrated API, never on the network, gets the same in ApiService.
		return toDesktopClientUrl(host, resolveDesktopListenHost(this.setting, true));
	}

	public get apiUrl(): string {
		return `${this.uiHostName}:${this.apiPort}`;
	}

	public get uiUrl(): string {
		return `${this.uiHostName}:${this.uiPort}`;
	}

	public get setting(): IServerSetting {
		return LocalStore.getStore('configs');
	}

	public set setting(value: IServerSetting) {
		LocalStore.updateConfigSetting(value);
	}
}
