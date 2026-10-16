import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable } from '../email-table';

const TABLE = 'inbox_provider_account';
const PREFIX = 'inbox_provider_account';

/** The account's own columns, after the base columns, per dialect. */
export function inboxProviderAccountColumns(d: InboxDialect): string {
	const { varchar, ts, bool, falsy, nul, def, c } = columnTypes(d);
	return [
		`${c('providerId')} ${varchar(32)} NOT NULL`,
		`${c('name')} ${varchar(120)} NOT NULL`,
		`${c('scope')} ${varchar(16)} NOT NULL ${def('ORGANIZATION')}`,
		`${c('status')} ${varchar(16)} NOT NULL ${def('ACTIVE')}`,
		`${c('isDefaultOutbound')} ${bool} NOT NULL ${falsy}`,
		`${c('config')} text${nul}`,
		`${c('configEncrypted')} text${nul}`,
		`${c('capabilities')} text${nul}`,
		`${c('lastVerifiedAt')} ${ts}${nul}`,
		`${c('lastError')} ${varchar(500)}${nul}`
	].join(', ');
}

export const INBOX_PROVIDER_ACCOUNT_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_provider`, columns: ['providerId'] },
	{ name: `IDX_${PREFIX}_default_outbound`, columns: ['tenantId', 'isDefaultOutbound'] }
];

/**
 * `inbox_provider_account` (plan 04 §2, G-P4-2): the email provider accounts of a tenant or an organization, with
 * their credentials encrypted. Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true`
 * load the Inbox email plugin. Idempotent on every dialect, serialised on Postgres, reversible.
 */
export class CreateInboxProviderAccountTable1791000002400 implements MigrationInterface {
	name = 'CreateInboxProviderAccountTable1791000002400';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxProviderAccountColumns,
			indexes: INBOX_PROVIDER_ACCOUNT_INDEXES
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
