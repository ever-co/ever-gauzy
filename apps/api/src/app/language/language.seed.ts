import { Connection } from 'typeorm';
import { Language } from './language.entity';

export const createLanguages = async (
	connection: Connection
): Promise<Language[]> => {
	const languages: Language[] = [];
	const languageNames = [
		'English',
		'Bengali',
		'Bulgarian',
		'Hindi',
		'Urdu',
		'Italian'
	];

	for (const name of languageNames) {
		const language = new Language();
		language.name = name;
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
