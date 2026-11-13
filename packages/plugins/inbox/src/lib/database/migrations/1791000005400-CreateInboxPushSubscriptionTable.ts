import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const TABLE = 'inbox_push_subscription';
const PREFIX = 'inbox_push_subscription';

/** The subscription's own key: its user; a row goes with them. */
export const INBOX_PUSH_SUBSCRIPTION_FOREIGN_KEYS = [
	{ name: `FK_${PREFIX}_user`, column: 'userId', references: 'user', onDelete: 'CASCADE' as const }
];

/** The subscription's own columns, after the base columns, per dialect. */
export function inboxPushSubscriptionColumns(d: InboxDialect): string {
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : 'datetime';
	const nul = d === 'mysql' ? ' NULL' : '';
	const c = (name: string) => q(d, name);
	return [
		`${c('userId')} ${uuid} NOT NULL`,
		`${c('employeeId')} ${uuid}${nul}`,
		`${c('endpoint')} text NOT NULL`,
		`${c('endpointHash')} varchar(64) NOT NULL`,
		`${c('p256dh')} text NOT NULL`,
		`${c('auth')} text NOT NULL`,
		`${c('expirationTime')} ${ts}${nul}`,
		`${c('userAgent')} varchar(255)${nul}`,
		`${c('lastUsedAt')} ${ts}${nul}`,
		`${c('failures')} int NOT NULL DEFAULT 0`
	].join(', ');
}

export const INBOX_PUSH_SUBSCRIPTION_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	// A device once per person (the endpoint's hash: an endpoint is too long for a key on MySQL).
	{ name: `UQ_${PREFIX}_user_endpoint`, columns: ['tenantId', 'userId', 'endpointHash'], unique: true },
	// The sweep's read: a person's devices.
	{ name: `IDX_${PREFIX}_user`, columns: ['userId'] }
];

/**
 * `inbox_push_subscription` (the Inbox spec FR-13): the browsers and devices a person subscribed to web push. Same
 * rules as the Inbox's other tables: registered only with the plugin that reads it, idempotent, serialised on
 * Postgres, reversible.
 */
export class CreateInboxPushSubscriptionTable1791000005400 implements MigrationInterface {
	name = 'CreateInboxPushSubscriptionTable1791000005400';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxPushSubscriptionColumns(d)}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${inboxPushSubscriptionColumns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			const own = INBOX_PUSH_SUBSCRIPTION_FOREIGN_KEYS.map(
				(fk) =>
					`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
			).join(', ');
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxPushSubscriptionColumns(d)}, ${sqliteForeignKeys(PREFIX)}, ${own})`
			);
		}
		for (const index of INBOX_PUSH_SUBSCRIPTION_INDEXES) {
			await createIndexIfMissing(queryRunner, TABLE, index);
		}
		for (const fk of [...baseForeignKeys(PREFIX), ...INBOX_PUSH_SUBSCRIPTION_FOREIGN_KEYS]) {
			await addForeignKeyIfMissing(queryRunner, TABLE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
