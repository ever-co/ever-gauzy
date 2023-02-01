import { Knex } from "knex";
import { TABLE_NAME_INTERVALS } from "../../../offline";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
		TABLE_NAME_INTERVALS,
		(table: Knex.TableBuilder) => {
			table.string('remoteId').nullable().alter();
		}
	);
}


export async function down(knex: Knex): Promise<void> {
}

