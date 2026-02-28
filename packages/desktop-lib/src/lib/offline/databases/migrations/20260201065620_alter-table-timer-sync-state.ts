import { Knex } from "knex";
import { TABLE_NAME_TIMERS } from "../../dto";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_TIMERS,
		(table: Knex.TableBuilder) => {
			table.string('startSyncState').nullable();
			table.string('stopSyncState').nullable();
			table.integer('syncDuration').nullable();
		}
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable(
		TABLE_NAME_TIMERS,
		(table: Knex.TableBuilder) => {
			table.dropColumn('startSyncState');
			table.dropColumn('stopSyncState');
			table.dropColumn('syncDuration');
		}
	);
}
