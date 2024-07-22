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

	/**
	 * Validate the provided URL for translation files.
	 * @returns true if the URL is valid, false otherwise.
	 */
	private validateUrl(): boolean {
		if (!this.i18nUrl) {
			console.warn('WARNING: No translation files URL provided');
			return false;
		}

		try {
			const url = new URL(this.i18nUrl);
			return !!url;
		} catch (error) {
			console.error(`ERROR: URL '${this.i18nUrl}' provided is not valid:`, error);
			return false;
		}
	}

	/**
	 * Download a JSON file for the specified language from the provided URL and save it to the destination directory.
	 * @param language The language code (e.g., 'en', 'fr').
	 */
	private async download(language: string): Promise<void> {
		try {
			const url = `${this.i18nUrl}/${language}.json`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to download ${url}: ${response.statusText}`);
			}

			const data = await response.json();
			const fileName = path.basename(url);
			const filePath = path.join(this.destination, fileName);

			fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
			console.log(`✔ File ${fileName} downloaded and saved to ${filePath}.`);
		} catch (error) {
			console.error(`❌ Error downloading language ${language}:`, error);
		}
	}

	/**
	 * Copy all files from the source directory to the destination directory.
	 */
	private copyAll(): void {
		const source = path.join('packages', 'ui-core', 'i18n', 'assets', 'i18n');
		fs.cpSync(source, this.destination, { recursive: true });
		console.log(`✔ All translations copied from ${source}.`);
	}

	/**
	 * Copy the JSON file for the specified language from the source directory to the destination directory.
	 * @param language The language code (e.g., 'en', 'fr').
	 */
	private copyOne(language: string): void {
		try {
			const fileName = `${language}.json`;
			const sourceFilePath = path.join('packages', 'ui-core', 'i18n', 'assets', 'i18n');
			const destinationFilePath = path.join(this.destination, fileName);

			fs.copyFileSync(sourceFilePath, destinationFilePath);

			console.log(`✔ Default translation ${fileName} copied from ${sourceFilePath} to ${destinationFilePath}`);
		} catch (error) {
			console.error(`❌ Error copying language '${language}':`, error);
		}
	}

	/**
	 * Download JSON files for all supported languages and save them to the destination directory.
	 * @returns A Promise that resolves when all files have been downloaded and saved.
	 */
	public async downloadAll(): Promise<void> {
		try {
			if (!fs.existsSync(this.destination)) {
				console.log(`✔ I18n directory created.`);
				fs.mkdirSync(this.destination);
			}

			if (!this.validateUrl()) {
				this.copyAll();
				return;
			}

			const downloadPromises = SupportedLanguage.list.map((language) => this.download(language));
			await Promise.all(downloadPromises);

			console.log(`✔ All translations downloaded successfully.`);
		} catch (error) {
			console.error(`❌ Error downloading translations:`, error);
		}
	}
}

(async () => {
	const translationUtil = new TranslationUtil();
	await translationUtil.downloadAll();
})();
