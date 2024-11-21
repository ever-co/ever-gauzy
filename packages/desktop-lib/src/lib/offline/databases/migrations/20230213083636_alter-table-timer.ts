import { TABLE_NAME_TIMERS } from '../../dto';
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
        TABLE_NAME_TIMERS,
        (table: Knex.TableBuilder) => {
            table.bigint('duration').alter();
        }
    );
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(
        TABLE_NAME_TIMERS,
        (table: Knex.TableBuilder) => {
            table.float('duration').alter();
        }
    );
}
