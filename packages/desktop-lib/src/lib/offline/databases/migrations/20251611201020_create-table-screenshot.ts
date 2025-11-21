
import { TABLE_NAME_SCREENSHOT } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_SCREENSHOT, (table) => {
		table.increments('id').primary();
		table.string('imagePath').notNullable().unique();
		table.boolean('synced').nullable();
		table.integer('activityId').notNullable();
		table.timestamp('recordedAt').notNullable();
		table.string('timeslotId').nullable();
		table.timestamps(true, true, true);
		table.index(['activityId']);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_SCREENSHOT);
}
