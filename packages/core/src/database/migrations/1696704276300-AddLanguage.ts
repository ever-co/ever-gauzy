import { MigrationInterface, QueryRunner } from 'typeorm';
import { LanguageUtils } from '../../language/language-utils';
import * as chalk from "chalk";
import { databaseTypes } from "@gauzy/config";

export class AddLanguage1696704276300 implements MigrationInterface {
	name = 'AddLanguage1696704276300';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        switch (queryRunner.connection.options.type) {
            case databaseTypes.sqlite:
            case databaseTypes.betterSqlite3:
            case databaseTypes.postgres:
                await this.sqlitePostgresUpAddLanguage(queryRunner);
                break;
            case databaseTypes.mysql:
                await this.mysqlUpAddLanguage(queryRunner);
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }
    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> { }

	/**
	 * Sqlite | better-sqlite3 | Postgres Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqlitePostgresUpAddLanguage(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		await LanguageUtils.migrateLanguages(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpAddLanguage(queryRunner: QueryRunner): Promise<any> { }

}
