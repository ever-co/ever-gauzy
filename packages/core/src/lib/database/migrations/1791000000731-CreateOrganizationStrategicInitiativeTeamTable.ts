import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The pivot this migration creates. */
const TABLE = 'organization_strategic_initiative_team';

/**
 * TypeORM's own names for the pivot's key, indexes and foreign keys (its default naming strategy: a hash of
 * the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_cb8d3efd443f50a66c6162c81aa',
	initiativeIndex: 'IDX_ffecd6e749d0dc1ce89b02e9a5',
	teamIndex: 'IDX_04e60eebe8d6ba3a336ec70770',
	initiativeForeignKey: 'FK_ffecd6e749d0dc1ce89b02e9a51',
	teamForeignKey: 'FK_04e60eebe8d6ba3a336ec707707'
} as const;

/**
 * Creates `organization_strategic_initiative_team`: the teams a strategic initiative is linked to directly
 * (G-P2-4 of the Gauzy ↔ Ever Works integration plan; an Ever Works Mission scoped to a Team maps to an
 * initiative linked to that team). With `visibilityScope = 'team'`, an initiative is then visible to the
 * members of the teams linked directly as well as of the teams of its aligned projects.
 *
 * Pure additive DDL: one new pivot (both columns form the key, each is indexed and cascades with its row).
 * No existing table or row is touched, so it is safe on a populated database. Every statement is guarded by
 * `hasTable`, so a re-run adds nothing, and `down` drops the pivot (its indexes and keys go with it).
 */
export class CreateOrganizationStrategicInitiativeTeamTable1791000000731 implements MigrationInterface {
	name = 'CreateOrganizationStrategicInitiativeTeamTable1791000000731';

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
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`DROP TABLE IF EXISTS "${TABLE}"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`DROP TABLE IF EXISTS \`${TABLE}\``);
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
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("organizationStrategicInitiativeId" uuid NOT NULL, "organizationTeamId" uuid NOT NULL, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("organizationStrategicInitiativeId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "${NAMES.initiativeIndex}" ON "${TABLE}" ("organizationStrategicInitiativeId") `
		);
		await queryRunner.query(`CREATE INDEX "${NAMES.teamIndex}" ON "${TABLE}" ("organizationTeamId") `);
		await queryRunner.query(
			`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.initiativeForeignKey}" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.teamForeignKey}" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite declares the foreign keys inside the table definition.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("organizationStrategicInitiativeId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, CONSTRAINT "${NAMES.initiativeForeignKey}" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "${NAMES.teamForeignKey}" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationStrategicInitiativeId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "${NAMES.initiativeIndex}" ON "${TABLE}" ("organizationStrategicInitiativeId") `
		);
		await queryRunner.query(`CREATE INDEX "${NAMES.teamIndex}" ON "${TABLE}" ("organizationTeamId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`organizationStrategicInitiativeId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`${NAMES.initiativeIndex}\` (\`organizationStrategicInitiativeId\`), INDEX \`${NAMES.teamIndex}\` (\`organizationTeamId\`), PRIMARY KEY (\`organizationStrategicInitiativeId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${NAMES.initiativeForeignKey}\` FOREIGN KEY (\`organizationStrategicInitiativeId\`) REFERENCES \`organization_strategic_initiative\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${NAMES.teamForeignKey}\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}
}
