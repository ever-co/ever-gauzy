import { Knex } from 'knex';
import { TABLE_PLUGINS } from '../../../plugin-system';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Add a new string column named 'marketplaceId'
		table.string('marketplaceId').nullable();
		// Add a new string column named 'versionId'
		table.string('versionId').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Drop the 'marketplaceId' column if the migration needs to be reverted
		table.dropColumn('marketplaceId');
		// Drop the 'versionId' column if the migration needs to be reverted
		table.dropColumn('versionId');
	});
}
