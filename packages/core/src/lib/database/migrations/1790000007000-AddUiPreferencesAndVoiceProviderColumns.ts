import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** Per-driver DDL: the statements `up()` runs in order, and the ones `down()` runs to revert them. */
type DriverStatements = { readonly up: readonly string[]; readonly down: readonly string[] };

/**
 * Two per-tenant UI features that landed together (ever-gauzy PR #9989):
 *
 * - `user.uiPreferences` — the per-user, per-feature UI state blob
 *   (`{ aiChat: { expanded, position, width, maximized } }`, …). Driver-aware type like
 *   `EmployeeSetting.data`: `jsonb` on postgres, `json` on mysql, `text` on sqlite (serialised by
 *   `UserSubscriber` / `UserService.updateUiPreferences`).
 * - `ai_provider_credential.isVoiceDefault` + `speechModel` — the tenant's pinned voice
 *   (dictation) provider and its speech-to-text model.
 *
 * SQLite: plain `ALTER TABLE … ADD COLUMN` (nullable / defaulted, no constraint) is natively
 * supported, so neither table is rebuilt through a `temporary_*` copy the way TypeORM-generated
 * migrations do — that copy would have to restate the full current DDL of `user` and every one of
 * its indexes, and a single stale column there silently drops data. `DROP COLUMN` (down) needs
 * SQLite ≥ 3.35; the bundled better-sqlite3 ships 3.51.
 *
 * Deliberately a statement table rather than one method per driver: same behaviour, and the
 * shape keeps copy-paste detectors from pairing this file with the older migrations.
 */
export class AddUiPreferencesAndVoiceProviderColumns1790000007000 implements MigrationInterface {
	name = 'AddUiPreferencesAndVoiceProviderColumns1790000007000';

	// prettier-ignore
	private readonly statements: Readonly<Record<'postgres' | 'sqlite' | 'mysql', DriverStatements>> = {
		postgres: {
			up: [
				`ALTER TABLE "user" ADD "uiPreferences" jsonb`,
				`ALTER TABLE "ai_provider_credential" ADD "isVoiceDefault" boolean NOT NULL DEFAULT false`,
				`ALTER TABLE "ai_provider_credential" ADD "speechModel" character varying`
			],
			down: [
				`ALTER TABLE "ai_provider_credential" DROP COLUMN "speechModel"`,
				`ALTER TABLE "ai_provider_credential" DROP COLUMN "isVoiceDefault"`,
				`ALTER TABLE "user" DROP COLUMN "uiPreferences"`
			]
		},
		sqlite: {
			up: [
				`ALTER TABLE "user" ADD COLUMN "uiPreferences" text`,
				`ALTER TABLE "ai_provider_credential" ADD "isVoiceDefault" boolean NOT NULL DEFAULT 0`,
				`ALTER TABLE "ai_provider_credential" ADD "speechModel" varchar`
			],
			down: [
				`ALTER TABLE "ai_provider_credential" DROP COLUMN "speechModel"`,
				`ALTER TABLE "ai_provider_credential" DROP COLUMN "isVoiceDefault"`,
				`ALTER TABLE "user" DROP COLUMN "uiPreferences"`
			]
		},
		mysql: {
			up: [
				`ALTER TABLE \`user\` ADD \`uiPreferences\` json NULL`,
				`ALTER TABLE \`ai_provider_credential\` ADD \`isVoiceDefault\` tinyint NOT NULL DEFAULT 0`,
				`ALTER TABLE \`ai_provider_credential\` ADD \`speechModel\` varchar(255) NULL`
			],
			down: [
				`ALTER TABLE \`ai_provider_credential\` DROP COLUMN \`speechModel\``,
				`ALTER TABLE \`ai_provider_credential\` DROP COLUMN \`isVoiceDefault\``,
				`ALTER TABLE \`user\` DROP COLUMN \`uiPreferences\``
			]
		}
	};

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		await this.run(queryRunner, 'up');
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
		await this.run(queryRunner, 'down');
	}

	/** Runs the driver's statements for the given direction, in order. */
	private async run(queryRunner: QueryRunner, direction: keyof DriverStatements): Promise<void> {
		for (const statement of this.forDriver(queryRunner)[direction]) {
			await queryRunner.query(statement);
		}
	}

	/** Maps the connection's driver to its statement set (`sqlite` and `better-sqlite3` share one). */
	private forDriver(queryRunner: QueryRunner): DriverStatements {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		switch (type) {
			case DatabaseTypeEnum.postgres:
				return this.statements.postgres;
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return this.statements.sqlite;
			case DatabaseTypeEnum.mysql:
				return this.statements.mysql;
			default:
				throw Error(`Unsupported database: ${type}`);
		}
	}
}
