import { TABLE_NAME_INTERVALS } from '../../../offline/dto/interval.dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists(TABLE_NAME_INTERVALS);
	await knex.schema.createTable(
		TABLE_NAME_INTERVALS,
		(table: Knex.TableBuilder) => {
			table.increments('id').primary().notNullable().unique();
			table.string('organizationId').notNullable();
			table.string('remoteId').notNullable();
			table.string('tenantId').notNullable();
			table.json('activities');
			table.integer('duration').notNullable().defaultTo(0);
			table.string('employeeId').notNullable();
			table.integer('keyboard').notNullable().defaultTo(0);
			table.integer('mouse').notNullable().defaultTo(0);
			table.integer('overall').notNullable().defaultTo(0);
			table.string('organizationContactId').notNullable();
			table.string('projectId').notNullable();
			table.string('screenshots').notNullable();
			table.timestamp('startedAt').notNullable();
			table.timestamp('stoppedAt').notNullable();
			table.boolean('synced').notNullable().defaultTo(false);
			table.timestamps(true, true, true);
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_INTERVALS);
}
