import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('heartbeats');
	await knex.schema.createTable('heartbeats', (table: Knex.TableBuilder) => {
		table.increments('id').primary().notNullable().unique();
		table.timestamp('time').notNullable();
		table.timestamps(true, true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable('heartbeats');
}
