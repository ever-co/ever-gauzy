import { TABLE_NAME_INTERVALS } from '../../dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
        TABLE_NAME_INTERVALS,
        (table: Knex.TableBuilder) => {
            table.dropColumn('version');
        }
    );
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
        TABLE_NAME_INTERVALS,
        (table: Knex.TableBuilder) => {
            table.string('version').nullable();
        }
    );
}
