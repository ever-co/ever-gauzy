import { Knex } from 'knex';
import { TABLE_PLUGINS } from '../../../plugin-system';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Add a new string column named 'marketplaceId'
		table.string('marketplaceId').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Drop the 'marketplaceId' column if the migration needs to be reverted
		table.dropColumn('marketplaceId');
	});
}
