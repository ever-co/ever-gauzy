import { TABLE_NAME_PROJECTS } from '../../../offline/dto/project.dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists(TABLE_NAME_PROJECTS);
	await knex.schema.createTable(
		TABLE_NAME_PROJECTS,
		(table: Knex.TableBuilder) => {
			table.increments('id').primary().notNullable().unique();
			table.string('organizationId').notNullable();
			table.string('remoteId').notNullable();
			table.string('tenantId').notNullable();
			table.string('contactId').notNullable();
			table.text('description').notNullable();
			table.string('imageUrl').nullable();
			table.string('name').notNullable();
			table.string('organizationContactId').notNullable();
			table.timestamps(true, true, true);
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_PROJECTS);
}
