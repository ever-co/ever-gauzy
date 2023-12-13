import { argv } from 'yargs';
import fetch from 'node-fetch';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '../env';
import { SupportedLanguage } from './supported-language';

export class TranslationUtil {
	public readonly desktop: string;
	public readonly destination: string;
	public readonly i18nUrl: string;
	public readonly translations = [];

	constructor() {
		this.desktop = String(argv.desktop || '');
		this.destination = path.join('apps', this.desktop, 'src', 'assets', 'i18n');
		this.i18nUrl = env.I18N_FILES_URL;
	}

	private validateUrl() {
		if (!this.i18nUrl) {
			console.warn('WARNING: No translation files url provided');
			return false;
		}
		try {
			const url = new URL(this.i18nUrl);
			return !!url;
		} catch (error) {
			console.error(`ERROR: Url '${this.i18nUrl}' provided is not valid: ` + error);
			return false;
		}
	}

	private async download(language: string): Promise<void> {
		const url = `${this.i18nUrl}/${language}.json`;
		const response = await fetch(url);
		const data = await response.json();
		const fileName = path.basename(url);
		fs.writeFileSync(path.join(this.destination, fileName), JSON.stringify(data, null, 4));
		console.log(`✔ File ${fileName} downloaded.`);
	}

	private copyAll(): void {
		const source = path.join('apps', 'gauzy', 'src', 'assets', 'i18n');
		fs.cpSync(source, this.destination, { recursive: true });
		console.log(`✔ All translations copied from ${source}.`);
	}

	private copyOne(language: string): void {
		try {
			const file = `${language}.json`;
			const source = path.join('apps', 'gauzy', 'src', 'assets', 'i18n', file);
			fs.copyFileSync(source, path.join(this.destination, file));
			console.log(`✔ Default translation ${language}.json copied from ${source}`);
		} catch (error) {
			console.log(`ERROR: Language '${language}' not copied:` + error);
		}
	}

	public async downloadAll(): Promise<void> {
		if (!fs.existsSync(this.destination)) {
			console.log(`✔ I18n directory created.`);
			fs.mkdirSync(this.destination);
		}
		if (!this.validateUrl()) {
			this.copyAll();
			return;
		}
		for (const language of SupportedLanguage.list) {
			try {
				await this.download(language);
			} catch (error) {
				console.error(`ERROR: Language '${language}' not available: ` + error);
				this.copyOne(language);
			}
		}
	}
}

(async () => {
	const translationUtil = new TranslationUtil();
	await translationUtil.downloadAll();
})();
