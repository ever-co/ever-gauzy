import { QueryRunner } from 'typeorm';
import { ILanguage, LanguagesEnum } from '@gauzy/contracts';
import allLanguages from './all-languages';
import { Language } from './language.entity';
import { faker } from '@faker-js/faker';
import { v4 as uuidV4 } from 'uuid';

export class LanguageUtils {
	private static async addLanguages(
		queryRunner: QueryRunner,
		languages: ILanguage[]
	): Promise<void> {
		for await (const language of languages) {
			const { name, code, is_system, description, color } = language;
			const payload = [name, code, is_system, description, color];
			let insertOrUpdateQuery = '';
			if (
				['sqlite', 'better-sqlite3'].includes(
					queryRunner.connection.options.type
				)
			) {
				payload.push(uuidV4());
				insertOrUpdateQuery = `
					INSERT INTO language (name, code, is_system, description, color, id)
					VALUES (?, ?, ?, ?, ?, ?)
					ON CONFLICT (code)
					DO UPDATE SET
						name = EXCLUDED.name,
						is_system = EXCLUDED.is_system,
						description = EXCLUDED.description,
						color = EXCLUDED.color;
				`;
			} else {
				insertOrUpdateQuery = `
					INSERT INTO language (name, code, is_system, description, color)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (code)
					DO UPDATE SET
						name = EXCLUDED.name,
						is_system = EXCLUDED.is_system,
						description = EXCLUDED.description,
						color = EXCLUDED.color;
				`;
			}
			await queryRunner.connection.manager.query(
				insertOrUpdateQuery,
				payload
			);
		}
	}

	public static get registeredLanguages(): ILanguage[] {
		const systemLanguages: string[] = Object.values(LanguagesEnum);
		const languages: ILanguage[] = [];
		for (const key in allLanguages) {
			if (Object.prototype.hasOwnProperty.call(allLanguages, key)) {
				const { name, nativeName } = allLanguages[key];
				const language = new Language();
				language.name = name;
				language.code = key;
				language.is_system = systemLanguages.indexOf(key) >= 0;
				language.description = nativeName;
				language.color = faker.internet.color();
				languages.push(language);
			}
		}
		return languages;
	}

	public static async migrateLanguages(
		queryRunner: QueryRunner
	): Promise<void> {
		await this.addLanguages(queryRunner, this.registeredLanguages);
	}
}
