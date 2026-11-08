import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, dropTableIfExists, lockMigrations } from '../migration-helpers';

const TABLE = 'inbox_sweep_checkpoint';
/** The notification filing's recovery sweep (`INBOX_NOTIFICATION_SWEEP_CHECKPOINT`). */
const NOTIFICATION_SWEEP = 'notification-filing';
/** The notification items' `externalSource` (`INBOX_NOTIFICATION_EXTERNAL_SOURCE`). */
const NOTIFICATION_SOURCE = 'gauzy-notification';

/**
 * `inbox_sweep_checkpoint` (the Inbox spec §4 Reliability): where a recovery sweep stands, one row per sweep — the
 * notification filing's sweep keeps its place here, so a worker that was down for any length of time resumes from
 * the last notification it settled. Not tenant data: no tenant or organization column, no foreign key.
 *
 * The sweep's first place is written here, not by the first sweep: where the Inbox started filing (its oldest
 * notification entry), or this moment when it has filed nothing yet — the Inbox's migrations run when it is switched
 * on, before anything is filed — so a filing that fails before a worker ever swept is still caught up.
 *
 * Same rules as the Inbox's other tables: registered only with the plugin, idempotent (a second run neither creates
 * nor moves anything), serialised on Postgres, reversible.
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
			await queryRunner.query(
				`INSERT INTO "${TABLE}" ("id", "cursorAt", "heldAttempts", "updatedAt") SELECT $1, COALESCE(MIN("createdAt"), now()), 0, now() FROM "inbox_item" WHERE "externalSource" = $2 ON CONFLICT ("id") DO NOTHING`,
				[NOTIFICATION_SWEEP, NOTIFICATION_SOURCE]
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (\`id\` varchar(64) NOT NULL, \`cursorAt\` datetime(6) NULL, \`cursorId\` varchar(64) NULL, \`heldId\` varchar(64) NULL, \`heldAttempts\` int NOT NULL DEFAULT 0, \`updatedAt\` datetime(6) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
			await queryRunner.query(
				`INSERT IGNORE INTO \`${TABLE}\` (\`id\`, \`cursorAt\`, \`heldAttempts\`, \`updatedAt\`) SELECT ?, COALESCE(MIN(\`createdAt\`), CURRENT_TIMESTAMP(6)), 0, CURRENT_TIMESTAMP(6) FROM \`inbox_item\` WHERE \`externalSource\` = ?`,
				[NOTIFICATION_SWEEP, NOTIFICATION_SOURCE]
			);
		} else {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" ("id" varchar(64) PRIMARY KEY NOT NULL, "cursorAt" datetime, "cursorId" varchar(64), "heldId" varchar(64), "heldAttempts" integer NOT NULL DEFAULT (0), "updatedAt" datetime)`
			);
			// The time as TypeORM writes one on SQLite (UTC, milliseconds).
			await queryRunner.query(
				`INSERT OR IGNORE INTO "${TABLE}" ("id", "cursorAt", "heldAttempts", "updatedAt") SELECT ?, COALESCE(MIN("createdAt"), strftime('%Y-%m-%d %H:%M:%f', 'now')), 0, strftime('%Y-%m-%d %H:%M:%f', 'now') FROM "inbox_item" WHERE "externalSource" = ?`,
				[NOTIFICATION_SWEEP, NOTIFICATION_SOURCE]
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
