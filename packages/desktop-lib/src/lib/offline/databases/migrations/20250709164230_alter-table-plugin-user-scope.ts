import { Knex } from 'knex';
import { TABLE_PLUGINS } from '../../../plugin-system';

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		// Add a nullable string column for per-user activation scoping
		table.string('userId').nullable();
		// Add an index on userId to improve lookup performance
		table.index(['userId'], 'idx_plugins_userId');
		// Add a boolean column to track tenant-level enabled state
		table.boolean('tenantEnabled').defaultTo(true);
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable(TABLE_PLUGINS, function (table) {
		table.dropIndex(['userId'], 'idx_plugins_userId');
		table.dropColumn('userId');
		table.dropColumn('tenantEnabled');
	});
}
