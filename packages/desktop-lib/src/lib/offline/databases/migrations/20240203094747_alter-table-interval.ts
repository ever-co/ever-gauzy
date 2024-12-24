import { Knex } from 'knex';
import { TABLE_NAME_INTERVALS } from '../../dto';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_INTERVALS, function (table) {
		// Add a new boolean column named 'isDeleted' with default value false
		table.boolean('isDeleted').defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_NAME_INTERVALS, function (table) {
		// Drop the 'isDeleted' column if the migration needs to be reverted
		table.dropColumn('isDeleted');
	});
}

