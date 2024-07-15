import { Knex } from 'knex';
import { TABLE_PLUGINS } from '../../../plugin-system';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists(TABLE_PLUGINS);
	await knex.schema.createTable(TABLE_PLUGINS, (table: Knex.TableBuilder) => {
		table.increments('id').primary().notNullable().unique();
		table.string('name').notNullable();
		table.string('main').notNullable();
		table.string('renderer').notNullable();
		table.string('pathname').notNullable();
		table.string('version').notNullable();
		table.boolean('isActivate').defaultTo(false);
		table.timestamps(true, true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_PLUGINS);
}
