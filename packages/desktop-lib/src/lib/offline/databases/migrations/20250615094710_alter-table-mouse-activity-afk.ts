import { Knex } from 'knex';
import { TABLE_NAME_KB_MOUSE_ACTIVITY } from '../../../offline';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function (table) {
		// Add afkDuration column to track AFK time
		table.integer('afkDuration').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function (table) {
		// Drop the afkDuration column if the migration needs to be reverted
		table.dropColumn('afkDuration');
	});
}
