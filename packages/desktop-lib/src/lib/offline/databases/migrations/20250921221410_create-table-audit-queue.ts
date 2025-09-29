import { TABLE_NAME_AUDIT_QUEUE } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_AUDIT_QUEUE, (table) => {
		table.increments('id').primary();
		table.text('queue_id').unique().notNullable();
		table.text('queue').notNullable();
		table.text('status').notNullable();
		table.integer('attempts').notNullable().defaultTo(0);
		table.integer('priority').notNullable();
		table.text('data').notNullable();
		table.timestamp('started_at');
		table.timestamp('finished_at');
		table.string('last_error');
		table.timestamps(true, true, true);
		table.index(['status', 'created_at'], 'idx_audit_status');
		table.index(['queue', 'status', 'created_at'], 'idx_audit_queue')
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_AUDIT_QUEUE);
}
