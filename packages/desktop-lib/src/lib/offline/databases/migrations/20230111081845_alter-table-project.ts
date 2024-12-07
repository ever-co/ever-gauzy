import { Knex } from "knex";
import { TABLE_NAME_PROJECTS } from "../../../offline/dto";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
		TABLE_NAME_PROJECTS,
		(table: Knex.TableBuilder) => {
			table.string('remoteId').nullable().alter();
			table.string('contactId').nullable().alter();
			table.text('description').nullable().alter();
			table.string('organizationContactId').nullable().alter();
		}
	);
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
		TABLE_NAME_PROJECTS,
		(table: Knex.TableBuilder) => {
			table.string('remoteId').nullable().alter();
			table.string('tenantId').notNullable().alter();
			table.string('contactId').notNullable().alter();
			table.text('description').notNullable().alter();
			table.string('organizationContactId').notNullable().alter();
		}
	);
}

