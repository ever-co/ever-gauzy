import { TABLE_NAME_USERS } from '../../../offline';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_USERS,
		(table: Knex.TableBuilder) => {
			table.string('email').nullable().alter();
			table.string('name').nullable().alter();
			table.json('employee').nullable().alter();
		}
	);
}

export async function down(knex: Knex): Promise<void> {}
