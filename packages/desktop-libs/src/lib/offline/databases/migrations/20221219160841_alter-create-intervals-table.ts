import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('intervals')
	await knex.schema.createTable('intervals', (table: Knex.TableBuilder) => {
		table.increments('id').primary().notNullable().unique();
		table.timestamp('startAt').notNullable();
		table.boolean('synced').defaultTo(false);
        table.json('activities');
        table.json("b64Imgs");
		table.integer('duration').notNullable().defaultTo(0);
		table.string('employeeId').notNullable();
		table.integer('keyboard').notNullable().defaultTo(0);
		table.integer('mouse').notNullable().defaultTo(0);
		table.string('organizationContactId').nullable();
		table.string('organizationId').notNullable();
		table.integer('overall').notNullable().defaultTo(0);
		table.string('projectId').nullable();
		table.string('tenantId').notNullable();
		table.string('timeLogId').nullable();
		table.timestamp('startedAt').notNullable();
		table.timestamp('endedAt').nullable();
		table.timestamps(true, true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return await knex.schema.dropTable('intervals');
}
