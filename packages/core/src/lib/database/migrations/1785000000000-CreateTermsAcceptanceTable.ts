import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { migrationSql } from 'terms-acceptance/typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Migration: create the `terms_acceptance` table.
 *
 * ## Additive by construction
 *
 * This migration creates one new table and nothing else. It does not add,
 * rename, widen, narrow or drop a column on any existing table, and it does not
 * touch `user`. Registration previously discarded the terms checkbox entirely,
 * so there is no existing column to migrate *from* and no backfill to do: rows
 * start appearing the moment the new signup path is deployed, and every account
 * created before that has, correctly, no acceptance on file.
 *
 * ## Postgres uses the package's own DDL
 *
 * The Postgres branch replays `migrationSql.up` from `terms-acceptance/typeorm`
 * verbatim rather than restating it. Keeping one source of truth for the schema
 * matters here more than usual: the row's `fingerprint` is a digest over its own
 * fields, so a column that silently truncates a value makes the record read back
 * as tampered. That DDL also installs a `BEFORE UPDATE OR DELETE` trigger which
 * raises — application-level immutability is a convention, a trigger is a rule.
 *
 * MySQL and SQLite get hand-written equivalents (no `timestamptz`, no `jsonb`,
 * no plpgsql triggers). The append-only guarantee on those drivers therefore
 * rests on the adapter alone, which is a real difference and is why production
 * runs Postgres.
 *
 * ## `down()` destroys evidence
 *
 * Dropping the table is standard for a migration and is what `down()` does here,
 * but note what it means: it deletes the proof of who agreed to what. In
 * production prefer to leave the table in place and stop writing to it.
 */
export class CreateTermsAcceptanceTable1785000000000 implements MigrationInterface {
	name = 'CreateTermsAcceptanceTable1785000000000';

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
	 * Replays the DDL published by `terms-acceptance/typeorm`, including the
	 * append-only trigger.
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const statement of migrationSql.up) {
			await queryRunner.query(statement);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const statement of migrationSql.down) {
			await queryRunner.query(statement);
		}
	}

	/**
	 * SqliteDB and BetterSqlite3DB Up Migration
	 *
	 * `accepted_at` is `datetime`, which TypeORM stores as a string carrying
	 * milliseconds — the precision the row's fingerprint is computed over.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "terms_acceptance" ("id" varchar(128) PRIMARY KEY NOT NULL, "subject_id" varchar(255) NOT NULL, "tenant_id" varchar(255), "document_id" varchar(255) NOT NULL, "version" varchar(64) NOT NULL, "sha256" varchar(64) NOT NULL, "accepted_at" datetime NOT NULL, "locale" varchar(35) NOT NULL, "ip_hash" varchar(64), "user_agent" varchar(512), "method" varchar(64) NOT NULL, "metadata" text, "fingerprint" varchar(64) NOT NULL)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "terms_acceptance_unique_idx" ON "terms_acceptance" ("subject_id", "tenant_id", "document_id", "version")`
		);
		await queryRunner.query(
			`CREATE INDEX "terms_acceptance_subject_idx" ON "terms_acceptance" ("subject_id", "document_id", "accepted_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "terms_acceptance_document_idx" ON "terms_acceptance" ("document_id", "version")`
		);
	}

	/**
	 * SqliteDB and BetterSqlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "terms_acceptance_document_idx"`);
		await queryRunner.query(`DROP INDEX "terms_acceptance_subject_idx"`);
		await queryRunner.query(`DROP INDEX "terms_acceptance_unique_idx"`);
		await queryRunner.query(`DROP TABLE "terms_acceptance"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * `datetime(3)` and not plain `datetime`: MySQL defaults to zero fractional
	 * seconds, which would truncate the milliseconds the fingerprint covers and
	 * make every record read back as tampered.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`terms_acceptance\` (\`id\` varchar(128) NOT NULL, \`subject_id\` varchar(255) NOT NULL, \`tenant_id\` varchar(255) NULL, \`document_id\` varchar(255) NOT NULL, \`version\` varchar(64) NOT NULL, \`sha256\` varchar(64) NOT NULL, \`accepted_at\` datetime(3) NOT NULL, \`locale\` varchar(35) NOT NULL, \`ip_hash\` varchar(64) NULL, \`user_agent\` varchar(512) NULL, \`method\` varchar(64) NOT NULL, \`metadata\` json NULL, \`fingerprint\` varchar(64) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`terms_acceptance_unique_idx\` ON \`terms_acceptance\` (\`subject_id\`, \`tenant_id\`, \`document_id\`, \`version\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`terms_acceptance_subject_idx\` ON \`terms_acceptance\` (\`subject_id\`, \`document_id\`, \`accepted_at\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`terms_acceptance_document_idx\` ON \`terms_acceptance\` (\`document_id\`, \`version\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`terms_acceptance_document_idx\` ON \`terms_acceptance\``);
		await queryRunner.query(`DROP INDEX \`terms_acceptance_subject_idx\` ON \`terms_acceptance\``);
		await queryRunner.query(`DROP INDEX \`terms_acceptance_unique_idx\` ON \`terms_acceptance\``);
		await queryRunner.query(`DROP TABLE \`terms_acceptance\``);
	}
}
