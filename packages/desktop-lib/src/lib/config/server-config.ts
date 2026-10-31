import { LocalStore } from '../desktop-store';
import { IServerConfig, IReadWriteFile, IServerSetting } from '../interfaces';
import { resolveDesktopListenHost, toDesktopClientUrl } from './desktop-listen-host';

export class ServerConfig implements IServerConfig {
	private _readWriteFile: IReadWriteFile;

	constructor(readWrite?: IReadWriteFile) {
		this._readWriteFile = readWrite;
	}

	public update(): void {
		if (!this._readWriteFile) return;

		try {
			// read original file
			let fileContent = this._readWriteFile.read();

			// replace all url in the file to normalize url file.
			fileContent = this._replaceUrl(fileContent, this.apiUrl);

			// remove duplicated content
			fileContent = this._removeDuplicates(fileContent);

			// override the original file
			this._readWriteFile.write(fileContent);
		} catch (error) {
			console.error('Cannot update initial Server file', error);
			throw new Error(error);
		}
	}

	private _replaceUrl(fileContent: string, newUrl: string): string {
		// Add http protocol if missing
		newUrl = newUrl.indexOf('http') === 0 ? newUrl : `http://${newUrl}`;
		// Regex pattern to match URLs with global flag (g)
		const regex = /api:\s*['"]((https?:\/\/[^'"]+))['"]/g;
		const match = regex.exec(fileContent);
		// Replace all occurrences of the URL with the new one
		return match ? fileContent.replace(regex, `api: '${newUrl}'`) : this._initialConfig(newUrl, fileContent);
	}

	private _removeDuplicates(text: string): string {
		// Regex pattern to match the <script>...</script> group
		const scriptRegex = /(<script>[\s\S]*?<\/script>)/g;

		// Find the duplicates and remove them
		const deduplicatedText = text.replace(scriptRegex, (match, p1, offset) => {
			// Keep the match if it's the first occurrence, remove duplicates
			return offset === text.indexOf(match) ? match : '';
		});

		return deduplicatedText;
	}

	private _initialConfig(url: string, fileContent: string) {
		const configStr = `
		<script> window._env = { api: '${url}' };
		if (typeof global === "undefined") {
			var global = window;
		}; </script>`;

		const elementToReplace = '</body>';

		return fileContent.replace(elementToReplace, configStr.concat('\n').concat(elementToReplace));
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

	/**
	 * The web UI of the server the app is set up with, when that server runs on this computer (the integrated or a
	 * local server); `null` for a remote server, whose web UI address the app has no way to know.
	 */
	public get localUiUrl(): string | null {
		return this.setting?.isLocalServer ? this.uiUrl : null;
	}

	public get setting(): IServerSetting {
		return LocalStore.getStore('configs');
	}

	public set setting(value: IServerSetting) {
		LocalStore.updateConfigSetting(value);
	}
}
