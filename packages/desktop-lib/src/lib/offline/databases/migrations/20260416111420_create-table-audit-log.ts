import { TABLE_NAME_AUDIT_LOG } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_AUDIT_LOG, (table) => {
		table.increments('id').primary();
		table.string('logLevel').nullable();
		table.string('message').nullable();
		table.timestamp('createdAt').defaultTo(knex.fn.now());
		table.string('serviceName').nullable();
		table.index(['logLevel']);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_AUDIT_LOG);
}
