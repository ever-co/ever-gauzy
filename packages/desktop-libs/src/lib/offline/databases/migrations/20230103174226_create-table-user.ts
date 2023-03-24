import { TABLE_NAME_USERS } from '../../dto/user.dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists(TABLE_NAME_USERS);
	await knex.schema.createTable(
		TABLE_NAME_USERS,
		(table: Knex.TableBuilder) => {
			table.increments('id').primary().notNullable().unique();
			table.string('organizationId').notNullable();
			table.string('remoteId').notNullable();
			table.string('tenantId').notNullable();
			table.string('email').notNullable();
			table.string('name').notNullable();
			table.string('employeeId').notNullable();
			table.json('employee');
			table.timestamps(true, true, true);
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable(TABLE_NAME_USERS);
}
