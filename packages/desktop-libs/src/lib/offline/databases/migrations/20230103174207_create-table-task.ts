import { TABLE_NAME_TASKS } from '../../dto/task.dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists(TABLE_NAME_TASKS);
	await knex.schema.createTable(
		TABLE_NAME_TASKS,
		(table: Knex.TableBuilder) => {
			table.increments('id').primary().notNullable().unique();
			table.string('organizationId').notNullable();
			table.string('remoteId').notNullable();
			table.string('tenantId').notNullable();
			table.string('creatorId').notNullable();
			table.text('description').notNullable();
			table.integer('estimate').notNullable();
			table.string('projectId').notNullable();
			table.string('status').notNullable();
			table.string('title').notNullable();
			table.string('taskNumber').notNullable();
			table.timestamps(true, true, true);
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_TASKS);
}
