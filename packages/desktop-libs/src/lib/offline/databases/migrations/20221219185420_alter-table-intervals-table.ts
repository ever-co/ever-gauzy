import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('intervals', (table: Knex.TableBuilder) => {
		table.string('apiHost');
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('intervals', (table: Knex.TableBuilder) => {
		table.dropColumn('apiHost');
    })
}