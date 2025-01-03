import { faker } from '@faker-js/faker';
import { QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';
import { ILanguage, LanguagesEnum } from '@gauzy/contracts';
import allLanguages from './all-languages';
import { Language } from './language.entity';

export class LanguageUtils {
	private static async addLanguages(queryRunner: QueryRunner, languages: ILanguage[]): Promise<void> {
		for await (const language of languages) {
			const { name, code, is_system, description, color } = language;

			let insertOrUpdateQuery = '';
			let payload: any[];
			switch (queryRunner.connection.options.type) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
					payload = [name, code, is_system ? 1 : 0, description, color];
					payload.push(uuidV4());
					console.log('Inserting languages: ', JSON.stringify(payload));
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
					break;
				case DatabaseTypeEnum.postgres:
					payload = [name, code, is_system, description, color];
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
					break;
				case DatabaseTypeEnum.mysql:
					payload = [name, code, is_system, description, color];
					insertOrUpdateQuery = `
						INSERT INTO language (name, code, is_system, description, color)
						VALUES (?, ?, ?, ?, ?)
						ON DUPLICATE KEY UPDATE
						name = VALUES(name),
						is_system = VALUES(is_system),
						description = VALUES(description),
						color = VALUES(color);
					`;
					break;
				default:
					throw Error(`
						cannot create query to add languages due to unsupported database type: ${queryRunner.connection.options.type}
					`);
			}

			await queryRunner.connection.manager.query(insertOrUpdateQuery, payload);
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

	public static async migrateLanguages(queryRunner: QueryRunner): Promise<void> {
		await this.addLanguages(queryRunner, this.registeredLanguages);
	}
}
