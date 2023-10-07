import { MigrationInterface, QueryRunner } from 'typeorm';
import { LanguageUtils } from '../../language/language-utils';
import * as chalk from "chalk";

export class AddLanguage1696704276300 implements MigrationInterface {
	name = 'AddLanguage1696704276300';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(`AddLanguage1696704276300 start running!`));
		try {
			await LanguageUtils.migrateLanguages(queryRunner);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {}
}
