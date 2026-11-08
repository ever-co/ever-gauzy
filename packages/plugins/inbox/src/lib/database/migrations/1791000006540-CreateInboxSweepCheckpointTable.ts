import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, dropTableIfExists, lockMigrations } from '../migration-helpers';

const TABLE = 'inbox_sweep_checkpoint';

/**
 * `inbox_sweep_checkpoint` (the Inbox spec §4 Reliability): where a recovery sweep stands, one row per sweep — the
 * notification filing's sweep keeps its place here, so a worker that was down for any length of time resumes from
 * the last notification it settled. Not tenant data: no tenant or organization column, no foreign key. Same rules as
 * the Inbox's other tables: registered only with the plugin, idempotent, serialised on Postgres, reversible.
 */
export class CreateInboxSweepCheckpointTable1791000006540 implements MigrationInterface {
	name = 'CreateInboxSweepCheckpointTable1791000006540';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" ("id" varchar(64) NOT NULL, "cursorAt" TIMESTAMP, "cursorId" varchar(64), "heldId" varchar(64), "heldAttempts" integer NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP, CONSTRAINT "PK_${TABLE}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (\`id\` varchar(64) NOT NULL, \`cursorAt\` datetime(6) NULL, \`cursorId\` varchar(64) NULL, \`heldId\` varchar(64) NULL, \`heldAttempts\` int NOT NULL DEFAULT 0, \`updatedAt\` datetime(6) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" ("id" varchar(64) PRIMARY KEY NOT NULL, "cursorAt" datetime, "cursorId" varchar(64), "heldId" varchar(64), "heldAttempts" integer NOT NULL DEFAULT (0), "updatedAt" datetime)`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
