// cspell:words PGHOST PGPORT PGDATABASE SAVEPOINT
// Run with PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE pointing to a test database:
// yarn nx run core:test-postgres-migrations
// All fixtures use a temporary table and each test rolls back its transaction.
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });
require('tsconfig-paths/register');

const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('pg');
const {
	UniqueTenantStripeCustomer1790000009000
} = require('../packages/core/src/lib/database/migrations/1790000009000-UniqueTenantStripeCustomer.ts');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function withTenantTable(run) {
	const client = new Client({ connectionTimeoutMillis: 10000 });
	await client.connect();
	try {
		await client.query('BEGIN');
		// Never resolve an unqualified migration table or index against application data.
		await client.query('SET LOCAL search_path TO pg_temp');
		await client.query('SET LOCAL statement_timeout TO 10000');
		await client.query('CREATE TEMP TABLE tenant (id uuid PRIMARY KEY, "stripeCustomerId" text)');
		await client.query('CREATE INDEX "IDX_tenant_stripe_customer_id" ON tenant ("stripeCustomerId")');
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			query: async (sql, parameters) => (await client.query(sql, parameters)).rows
		};
		await run(client, queryRunner, new UniqueTenantStripeCustomer1790000009000());
	} finally {
		await client.query('ROLLBACK');
		await client.end();
	}
}

test('migrates UUID tenants with no Stripe links and permits multiple null links', async () => {
	await withTenantTable(async (client, queryRunner, migration) => {
		await client.query('INSERT INTO tenant VALUES ($1, NULL), ($2, NULL)', [id(1), id(2)]);
		await migration.up(queryRunner);
		await client.query('INSERT INTO tenant VALUES ($1, NULL)', [id(3)]);
		assert.equal((await client.query('SELECT count(*)::int AS count FROM tenant')).rows[0].count, 3);
	});
});

test('retains one UUID tenant per customer, clears only duplicates and enforces uniqueness', async () => {
	await withTenantTable(async (client, queryRunner, migration) => {
		await client.query('INSERT INTO tenant VALUES ($1, $6), ($2, $6), ($3, $6), ($4, $7), ($5, NULL)', [
			id(3),
			id(1),
			id(2),
			id(4),
			id(5),
			'cus_shared',
			'cus_independent'
		]);
		await migration.up(queryRunner);
		assert.deepEqual((await client.query('SELECT * FROM tenant ORDER BY id')).rows, [
			{ id: id(1), stripeCustomerId: 'cus_shared' },
			{ id: id(2), stripeCustomerId: null },
			{ id: id(3), stripeCustomerId: null },
			{ id: id(4), stripeCustomerId: 'cus_independent' },
			{ id: id(5), stripeCustomerId: null }
		]);
		await client.query('SAVEPOINT duplicate_insert');
		await assert.rejects(client.query('INSERT INTO tenant VALUES ($1, $2)', [id(6), 'cus_shared']), {
			code: '23505'
		});
		await client.query('ROLLBACK TO SAVEPOINT duplicate_insert');
		await migration.down(queryRunner);
		await client.query('INSERT INTO tenant VALUES ($1, $2)', [id(6), 'cus_shared']);
	});
});
