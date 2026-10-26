import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable, EmailTableForeignKey } from '../email-table';

const TABLE = 'inbox_mailbox';
const PREFIX = 'inbox_mailbox';

/** The table's own columns, after the base columns, per dialect. */
export function inboxMailboxColumns(d: InboxDialect): string {
	const { varchar, uuid, ts, bool, int, falsy, zero, nul, def, c } = columnTypes(d);
	return [
		`${c('address')} ${varchar(320)} NOT NULL`,
		`${c('displayName')} ${varchar(200)}${nul}`,
		`${c('kind')} ${varchar(16)} NOT NULL ${def('PLATFORM')}`,
		`${c('ownerType')} ${varchar(16)} NOT NULL`,
		`${c('ownerEmployeeId')} ${uuid}${nul}`,
		`${c('ownerTeamId')} ${uuid}${nul}`,
		`${c('purpose')} ${varchar(16)} NOT NULL ${def('INBOX')}`,
		`${c('providerAccountId')} ${uuid}${nul}`,
		`${c('inboundSecretHash')} ${varchar(255)}${nul}`,
		`${c('senderAllowlist')} text${nul}`,
		`${c('domain')} ${varchar(253)}${nul}`,
		`${c('domainStatus')} ${varchar(16)}${nul}`,
		`${c('domainVerificationToken')} ${varchar(128)}${nul}`,
		`${c('isDefault')} ${bool} NOT NULL ${falsy}`,
		`${c('autoProvisioned')} ${bool} NOT NULL ${falsy}`,
		`${c('lastMessageAt')} ${ts}${nul}`,
		`${c('messageCount')} ${int} NOT NULL ${zero}`,
		`${c('settings')} text${nul}`
	].join(', ');
}

export const INBOX_MAILBOX_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	// The address alone routes a message to a tenant: unique across the whole deployment (a security control).
	{ name: `UQ_${PREFIX}_address`, columns: ['address'], unique: true },
	{ name: `IDX_${PREFIX}_owner_employee`, columns: ['ownerEmployeeId'] },
	{ name: `IDX_${PREFIX}_owner_team`, columns: ['ownerTeamId'] },
	{ name: `IDX_${PREFIX}_provider_account`, columns: ['providerAccountId'] },
	{ name: `IDX_${PREFIX}_domain`, columns: ['domain'] }
];

export const INBOX_MAILBOX_FOREIGN_KEYS: EmailTableForeignKey[] = [
	{
		name: `FK_${PREFIX}_provider_account`,
		column: 'providerAccountId',
		references: 'inbox_provider_account',
		onDelete: 'SET NULL'
	}
];

/**
 * `inbox_mailbox` (plan 04 §2, §5.1, G-P4-2): the addresses mail is received for (employee, organization, team);
 * the address is unique across the deployment.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 * Idempotent on every dialect (a re-run issues no DDL and repairs what a failed run left out), serialised on
 * Postgres, reversible (`down` drops the table).
 */
export class CreateInboxMailboxTable1791000002500 implements MigrationInterface {
	name = 'CreateInboxMailboxTable1791000002500';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxMailboxColumns,
			indexes: INBOX_MAILBOX_INDEXES,
			foreignKeys: INBOX_MAILBOX_FOREIGN_KEYS
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
