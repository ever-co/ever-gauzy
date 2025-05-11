import { TABLE_NAME_KB_MOUSE_ACTIVITY } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable(TABLE_NAME_KB_MOUSE_ACTIVITY, (table) => {
		table.increments('id').primary().notNullable().unique();
		table.timestamp('timeStart');
		table.timestamp('timeEnd');
		table.integer('kbPressCount');
		table.json('kbSequence');
		table.integer('mouseMovementsCount');
		table.integer('mouseLeftClickCount');
		table.integer('mouseRightClickCount');
		table.json('mouseEvents');
		table.string('organizationId');
		table.string('tenantId');
		table.string('remoteId');
		table.timestamps(true, true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_KB_MOUSE_ACTIVITY);
}
