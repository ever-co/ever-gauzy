import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('window-events');
	await knex.schema.createTable('window-events', (table) => {
		table.increments('id').primary().notNullable().unique();
		table.bigInteger('eventId').notNullable().unique();
		table.float('duration');
		table.bigInteger('timerId');
		table.json('data');
		table.timestamp('date');
		table.string('activityId');
		table.string('type');
		table.string('created_at');
		table.string('updated_at');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('window-events');
}
