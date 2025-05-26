import { TABLE_NAME_KB_MOUSE_ACTIVITY } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_KB_MOUSE_ACTIVITY, (table) => {
		table.increments('id').primary();
		table.timestamp('timeStart').notNullable();
		table.timestamp('timeEnd').notNullable();
		table.integer('kbPressCount').notNullable().defaultTo(0);
		table.json('kbSequence').notNullable();
		table.integer('mouseMovementsCount').notNullable().defaultTo(0);
		table.integer('mouseLeftClickCount').notNullable().defaultTo(0);
		table.integer('mouseRightClickCount').notNullable().defaultTo(0);
		table.json('mouseEvents').notNullable();
		table.string('organizationId').notNullable();
		table.string('tenantId').notNullable();
		table.string('remoteId').notNullable();
		table.json('screenshots').notNullable().defaultTo('[]');
		table.timestamps(true, true, true);
		table.index(['timeStart', 'timeEnd']);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_KB_MOUSE_ACTIVITY);
}
