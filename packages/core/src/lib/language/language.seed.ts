import { DataSource } from 'typeorm';
import { ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { Language } from './language.entity';
import allLanguages from './all-languages';

/**
 * Seeds the database with a list of supported languages.
 *
 * Iterates over all defined languages and populates each with:
 * - name
 * - ISO code
 * - system flag (if part of `LanguagesEnum`)
 * - default empty description
 * - randomly generated color
 *
 * Saves the language records to the provided TypeORM `DataSource` and returns them.
 *
 * @param dataSource - The TypeORM DataSource to access the database.
 * @returns A Promise resolving to an array of saved `ILanguage` entities.
 */
export const createLanguages = async (dataSource: DataSource): Promise<ILanguage[]> => {
	const systemLanguages: string[] = Object.values(LanguagesEnum);
	const languages: ILanguage[] = [];

	for (const key in allLanguages) {
		if (Object.prototype.hasOwnProperty.call(allLanguages, key)) {
			const { name } = allLanguages[key];

			const language = new Language();
			language.name = name;
			language.code = key;
			language.is_system = systemLanguages.includes(key);
			language.description = '';
			language.color = faker.color.rgb();

			languages.push(language);
		}
	}

	try {
		await dataSource.getRepository(Language).save(languages);
	} catch (error) {
		console.error('Error while saving languages', error);
	}

	return languages;
};
