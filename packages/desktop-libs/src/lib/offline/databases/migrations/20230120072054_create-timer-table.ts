import { TABLE_NAME_TIMERS } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_TIMERS, (table) => {
		table.increments('id').primary().notNullable().unique();
		table.timestamp('day');
		table.float('duration');
		table.string('taskId');
		table.string('projectId');
		table.string('employeeId');
		table.string('timelogId');
		table.string('timesheetId');
		table.string('timeslotId');
		table.timestamps(true, true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_TIMERS);
}
