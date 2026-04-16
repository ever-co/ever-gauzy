import { TABLE_NAME_SYNC_LOG } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_SYNC_LOG, (table) => {
		table.increments('id').primary();
		table.text('payload').nullable();
		table.string('status').nullable();
		table.integer('key').notNullable();
		table.string('errorMessage').nullable();
		table.text('response').nullable();
		table.timestamp('createdAt').defaultTo(knex.fn.now());
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_SYNC_LOG);
}
