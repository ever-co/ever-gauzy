import { Connection } from 'typeorm';
import { LanguagesEnum } from '@gauzy/contracts';
import * as faker from 'faker';
import { Language } from './language.entity';
import  allLanguages from './all-languages';

export const createLanguages = async (
	connection: Connection
): Promise<Language[]> => {
	const systemLanguages: string[] = Object.values(LanguagesEnum);
	const languages: Language[] = [];
	for (const key in allLanguages) {
		if (Object.prototype.hasOwnProperty.call(allLanguages, key)) {
			const { name } = allLanguages[key];
			const language = new Language();
			language.name = name;
			language.code = key;
			language.is_system = systemLanguages.indexOf(key) >= 0;
			language.description = '';
			language.color = faker.internet.color();
			languages.push(language);
		}
	}
	try {
		await connection.getRepository(Language).save(languages)
	} catch (error) {
		console.log({error})
	}
	return languages;
};
