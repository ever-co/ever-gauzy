import { Knex } from 'knex';
import { TABLE_NAME_KB_MOUSE_ACTIVITY } from '../../../offline';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function (table) {
		// Add activeWindows column to track active app
		table.json('activeWindows').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function (table) {
		// Drop the activeWindows column if the migration needs to be reverted
		table.dropColumn('activeWindows');
	});
}
