
import { Knex } from 'knex';
import { TABLE_NAME_KB_MOUSE_ACTIVITY, TABLE_NAME_TIMERS } from '../../../offline';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function(table) {
		// Add syncedActivity and isOffline and timerId column to track active app
		table.enum('activityState', ['active', 'idle']).nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_KB_MOUSE_ACTIVITY, function(table) {
		// Drop the syncedActivity and isOffline and timerId column if the migration needs to be reverted
		table.dropColumn('activityState');
	});
}
