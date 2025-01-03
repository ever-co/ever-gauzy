import { Knex } from "knex";
import {TABLE_NAME_TIMERS} from "../../dto";


export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_TIMERS,
		(table: Knex.TableBuilder) => {
			table.string('organizationTeamId').nullable();
			table.string('description').nullable();
		}
	);
}


export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_TIMERS,
		(table: Knex.TableBuilder) => {
			table.dropColumn('organizationTeamId');
			table.dropColumn('description');
		}
	);
}

