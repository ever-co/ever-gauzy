import { Knex } from 'knex';
import { ProviderFactory, TABLE_NAME_INTERVALS, TABLE_NAME_TIMERS } from '../../../offline';

export async function up(knex: Knex): Promise<void> {
	if (ProviderFactory.instance.dialect === 'postgres') return;
	await knex.schema.alterTable(TABLE_NAME_INTERVALS, (table: Knex.TableBuilder) => {
		table.integer('timerId').unsigned().references('id').inTable(TABLE_NAME_TIMERS).onDelete('SET NULL').alter();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(TABLE_NAME_INTERVALS, (table: Knex.TableBuilder) => {
		table.dropForeign(['timerId']);
	});
}
