import { LocalStore } from '../../desktop-store';
import { IProxyConfig, IReadWriteFile } from '../../interfaces';

export class ProxyConfig implements IProxyConfig {
	private _readWriteFile: IReadWriteFile;

	constructor(readWrite?: IReadWriteFile) {
		this._readWriteFile = readWrite;
	}

	public update(url: string): void {
		if (!this._readWriteFile) return;
		// read original file
		let fileContent = this._readWriteFile.read();
		// replace all url in the file to normalize url file.
		fileContent = this._replaceUrl(fileContent, url);
		// remove duplicated content
		fileContent = this._removeDuplicates(fileContent);
		// override the original file
		this._readWriteFile.write(fileContent);
	}

	private _replaceUrl(text: string, newUrl: string): string {
		// Regex pattern to match URLs with global flag (g)
		const regex = /(['"])(https?:\/\/.*?)(['"])/g;

		// Replace all occurrences of the URL with the new one
		const replacedText = text.replace(regex, '$1' + newUrl + '$3');

		return replacedText;
	}

	private _removeDuplicates(text: string): string {
		// Regex pattern to match the <script>...</script> group
		const scriptRegex = /(<script>[\s\S]*?<\/script>)/g;

		// Find the duplicates and remove them
		const deduplicatedText = text.replace(
			scriptRegex,
			(match, p1, offset) => {
				// Keep the match if it's the first occurrence, remove duplicates
				return offset === text.indexOf(match) ? match : '';
			}
		);

		return deduplicatedText;
	}

	private get _config() {
		return LocalStore.getStore('configs');
	}

	public get apiPort(): number {
		return Number(this._config.port);
	}

	public get uiPort(): number {
		return Number(this._config.portUi);
	}

	public get forwardApiBaseUrl(): string {
		if (this.uiHostName) {
			return this.uiPort
				? `${this.uiHostName}:${this.apiPort + 1}`
				: `${this.uiHostName}:3001`;
		}
		return `http://0.0.0.0:3001`;
	}

	public get uiHostName(): string {
		return this._config.host;
	}

	public get apiBaseUrl(): string {
		if (this._config.serverUrl) return this._config.serverUrl;
		else {
			return this.apiPort
				? `http://localhost:${this.apiPort}`
				: `http://localhost:3000`;
		}
	}
}
