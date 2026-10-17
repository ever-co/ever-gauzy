import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable } from '../email-table';

const TABLE = 'inbox_organization_setting';
const PREFIX = 'inbox_organization_setting';

export function inboxOrganizationSettingColumns(d: InboxDialect): string {
	const { bool, falsy, c } = columnTypes(d);
	return [`${c('autoProvisionEmployees')} ${bool} NOT NULL ${falsy}`].join(', ');
}

export const INBOX_ORGANIZATION_SETTING_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	// One row per organization.
	{ name: `UQ_${PREFIX}_organization`, columns: ['tenantId', 'organizationId'], unique: true }
];

/**
 * `inbox_organization_setting` (plan 04 §5.1, G-P4-1): an organization's Inbox email settings (auto-provisioning).
 * Registered only where the Inbox email plugin is loaded. Idempotent, serialised on Postgres, reversible.
 */
export class CreateInboxOrganizationSettingTable1791000003000 implements MigrationInterface {
	name = 'CreateInboxOrganizationSettingTable1791000003000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxOrganizationSettingColumns,
			indexes: INBOX_ORGANIZATION_SETTING_INDEXES
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
