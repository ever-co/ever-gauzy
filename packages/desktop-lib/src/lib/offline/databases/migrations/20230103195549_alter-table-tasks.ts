import { Knex } from 'knex';
import { TABLE_NAME_TAGS } from '../../../offline/dto/tag.dto';
import { TABLE_NAME_TASKS } from '../../../offline/dto/task.dto';
import { TABLE_NAME_USERS } from '../../../offline/dto/user.dto';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_TASKS,
		(table: Knex.TableBuilder) => {
			table
				.integer('tags')
				.unsigned()
				.index()
				.references('id')
				.inTable(TABLE_NAME_TAGS)
				.onDelete('SET NULL');
			table
				.integer('members')
				.unsigned()
				.index()
				.references('id')
				.inTable(TABLE_NAME_USERS)
				.onDelete('SET NULL');
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('TABLE_NAME_TASKS', (table: Knex.TableBuilder) => {
		table.dropColumn('tags');
		table.dropColumn('members');
	});
}
