import { Knex } from 'knex';
import { TABLE_PLUGINS } from '../../../plugin-system';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Add a new string column named 'logo'
		table.string('logo').nullable();
		// Add a new string column named 'description'
		table.string('description').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Drop the 'logo' column if the migration needs to be reverted
		table.dropColumn('logo');
		// Drop the 'description' column if the migration needs to be reverted
		table.dropColumn('description');
	});
}
