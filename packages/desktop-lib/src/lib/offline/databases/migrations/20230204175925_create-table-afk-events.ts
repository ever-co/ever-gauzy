import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('afk-events');
	await knex.schema.createTable('afk-events', (table) => {
		table.increments('id').primary().notNullable().unique();
		table.bigInteger('eventId').notNullable().unique();
		table.float('duration');
		table.bigInteger('timerId');
		table.json('data');
		table.timestamp('date');
		table.string('timeSlotId');
		table.string('timeSheetId');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('afk-events');
}
