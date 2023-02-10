import { TABLE_NAME_TIMERS } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(TABLE_NAME_TIMERS, (table: Knex.TableBuilder) => {
		table.boolean('synced').defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(TABLE_NAME_TIMERS, (table: Knex.TableBuilder) => {
		table.dropColumn('synced');
	});
}
