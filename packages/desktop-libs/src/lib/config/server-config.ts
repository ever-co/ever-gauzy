import { LocalStore } from '../desktop-store';
import { IServerConfig, IReadWriteFile, IServerSetting } from '../interfaces';

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
		return Number(this.setting?.port) || 3800;
	}

	public get uiPort(): number {
		return Number(this.setting?.portUi) || 4200;
	}

	public get uiHostName(): string {
		const defaultHost = 'http://0.0.0.0';

		if (!this.setting?.host) {
			return defaultHost;
		}

		let host = this.setting.host.startsWith('http') ? this.setting.host : `http://${this.setting.host}`;

		if (process.platform === 'win32' && host === defaultHost) {
			return 'http://127.0.0.1';
		}

		return host;
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
