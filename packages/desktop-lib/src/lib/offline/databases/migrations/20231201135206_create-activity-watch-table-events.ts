import { Knex } from 'knex';
import { TABLE_NAME_TIMERS } from '../../dto';
import { ActivityWatchEventTableList } from '../../../integrations';

const tableNames = Object.values(ActivityWatchEventTableList);

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('window-events');
	await knex.schema.dropTableIfExists('afk-events');
	await knex.schema.dropTableIfExists('failed-request');
	await Promise.all(
		tableNames.map(async (tableName) => {
			await knex.schema.createTable(tableName, (table) => {
				table.increments('id').primary();
				table.bigInteger('eventId').notNullable().unique();
				table.float('duration').nullable();
				table.json('data').nullable();
				table.string('timeSlotId').nullable();
				table.string('type').nullable();
				table.string('recordedAt').nullable();
				table.timestamps(true, true, true);
				table
					.integer('timerId')
					.notNullable()
					.unsigned()
					.references('id')
					.inTable(TABLE_NAME_TIMERS)
					.onDelete('CASCADE');
			});
		})
	);
}

export async function down(knex: Knex): Promise<void> {
	await Promise.all(
		tableNames.map(async (tableName) => {
			await knex.schema.dropTableIfExists(tableName);
		})
	);
}
