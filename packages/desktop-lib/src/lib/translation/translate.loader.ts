import fs from 'fs';
import { AppError } from '../error-handler';
import * as path from 'path';
import { ITranslation } from './i-translation';

export class TranslateLoader {
	private static _translations: ITranslation = {};

	private constructor() {}

	public static load(translationsFilesDirectoryPath: string): boolean {
		try {
			// Load translation files, then parse them
			fs
				// Read directory with translations
				.readdirSync(path.resolve(translationsFilesDirectoryPath))

				// Filter only JSON files
				.filter((files) => files.indexOf('.') !== 0 && files.slice(-5) === '.json')

				// Parse those files
				.forEach((fileName) => {
					// Keeping main execution process in safe
					try {
						// Read language name
						const language = fileName.split('.')[0];

						// Read translation file
						let fileContent = fs.readFileSync(
							path.resolve(translationsFilesDirectoryPath, fileName),
							'utf-8'
						) as any;

						// Parse it
						fileContent = JSON.parse(fileContent) as ITranslation;

						// Push dictionary into buffers
						this._translations[language] = {
							...this._flattenObject(fileContent)
						};
					} catch (error) {
						throw new AppError('TRANSLATION', error);
					}
				});

			// Check amount of available translations
			if (Object.keys(this._translations).length === 0) {
				console.error('No translations available');
			}
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}

	private static _flattenObject(nestedObject: ITranslation, prefix = '', result: ITranslation = {}): ITranslation {
		for (const key in nestedObject) {
			if (Object.prototype.hasOwnProperty.call(nestedObject, key)) {
				const value = nestedObject[key];
				const newKey = prefix ? `${prefix}.${key}` : key;

				if (typeof value === 'object' && !Array.isArray(value)) {
					// Recursively flatten nested objects
					this._flattenObject(value, newKey, result);
				} else {
					result[newKey] = value;
				}
			}
		}

		return result;
	}

	public static get translations(): ITranslation {
		return this._translations;
	}
}
