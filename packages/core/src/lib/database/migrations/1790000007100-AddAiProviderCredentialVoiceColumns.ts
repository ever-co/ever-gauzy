import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the per-tenant VOICE (dictation / speech-to-text) preferences to `ai_provider_credential`:
 *
 * - `isVoiceDefault` — the credential flagged as the tenant's dictation provider (at most one per
 *   tenant, enforced by `AiProviderCredentialService.clearOtherVoiceDefaults`; independent of the
 *   chat `isDefault` flag).
 * - `speechModel` — the tenant's preferred speech-to-text model for that provider.
 *
 * Both are additive with defaults, so existing rows need no backfill.
 */
export class AddAiProviderCredentialVoiceColumns1790000007100 implements MigrationInterface {
	name = 'AddAiProviderCredentialVoiceColumns1790000007100';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
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
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD "isVoiceDefault" boolean NOT NULL DEFAULT false`
		);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" ADD "speechModel" character varying`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP COLUMN "speechModel"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP COLUMN "isVoiceDefault"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports `ADD COLUMN` for nullable columns and for NOT NULL columns with a constant
	 * default, which is all this migration needs — no temporary-table rebuild.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" ADD "isVoiceDefault" boolean NOT NULL DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" ADD "speechModel" varchar`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP COLUMN "speechModel"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP COLUMN "isVoiceDefault"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD \`isVoiceDefault\` tinyint NOT NULL DEFAULT 0`
		);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` ADD \`speechModel\` varchar(255) NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP COLUMN \`speechModel\``);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP COLUMN \`isVoiceDefault\``);
	}
}
