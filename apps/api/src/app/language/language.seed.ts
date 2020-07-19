import { Connection } from 'typeorm';
import { Language } from './language.entity';

export const createLanguages = async (
	connection: Connection
): Promise<Language[]> => {
	const languages: Language[] = [];
	const languageItems = [
		{ name: 'English', code: 'en', is_system: true },
		{ name: 'Bulgarian', code: 'bg', is_system: true },
		{ name: 'Hebrew', code: 'he', is_system: true },
		{ name: 'Russian', code: 'ru', is_system: true }
	];

	for (const item of languageItems) {
		const language = new Language();
		language.name = item.name;
		language.code = item.code;
		language.is_system = item.is_system || false;
		language.description = '';
		language.color = '#479bfa';
		languages.push(language);
	}

	await connection
		.createQueryBuilder()
		.insert()
		.into(Language)
		.values(languages)
		.execute();

	return languages;
};
