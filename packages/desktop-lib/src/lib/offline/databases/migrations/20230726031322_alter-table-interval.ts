import { TABLE_NAME_INTERVALS, TABLE_NAME_TIMERS } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_INTERVALS,
		(table: Knex.TableBuilder) => {
			table
				.integer('timerId')
				.unsigned()
				.references(TABLE_NAME_TIMERS + '.id');
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_INTERVALS,
		(table: Knex.TableBuilder) => {
			table.dropColumn('timerId');
		}
	);
}
