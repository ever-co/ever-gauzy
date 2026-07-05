import { Knex } from "knex";
import { TABLE_NAME_SCREENSHOT } from "../../dto";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_SCREENSHOT,
		(table: Knex.TableBuilder) => {
			table.string('message').nullable();
			table.integer('retries').nullable().defaultTo(0);
			table.timestamp('lastAttemptAt').nullable();
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_SCREENSHOT,
		(table: Knex.TableBuilder) => {
			table.dropColumn('message');
			table.dropColumn('retries');
			table.dropColumn('lastAttemptAt');
		}
	);
}
