import { Knex } from 'knex';
import { TABLE_NAME_USERS } from '../../../offline';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_USERS,
		(table: Knex.TableBuilder) => {
			table.string('remoteId').unique().alter();
		}
	);
}

export async function down(knex: Knex): Promise<void> {}
