import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { EverConnectProvisionStore } from '../../ever-connect-provision.store';
import {
	createCoreTables,
	dropTables,
	insert,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	TEST_TARGETS
} from '../../fixtures/test-db';

const MIGRATIONS = join(__dirname, '../../../../../../core/src/lib/database/migrations');

/**
 * The core `EverConnectProvision` migration on every database the suites reach (SQLite always;
 * Postgres and MySQL with `EVER_CONNECT_TEST_POSTGRES_URL` / `EVER_CONNECT_TEST_MYSQL_URL`): `up`
 * creates the two tables with their unique keys, running it again changes nothing, and `down` removes
 * exactly them.
 */
describe.each(TEST_TARGETS)('EverConnectProvision migration on $name', (target) => {
	let dataSource: DataSource;
	const { EverConnectProvision1791000003950 } = require(join(MIGRATIONS, '1791000003950-EverConnectProvision'));

	beforeEach(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, target.name, PLUGIN_TABLES);
		await createCoreTables(dataSource, target.name);
		await migrateUp(dataSource);
	});

	afterEach(async () => {
		await dropTables(dataSource, target.name, PLUGIN_TABLES);
		await dataSource.destroy();
	});

	async function has(table: string, column?: string): Promise<boolean> {
		const runner = dataSource.createQueryRunner();
		try {
			return column ? await runner.hasColumn(table, column) : await runner.hasTable(table);
		} finally {
			await runner.release();
		}
	}

	it('up creates the tables; running it again is harmless; down removes them and nothing else', async () => {
		expect(await has('ever_connect_provision_intent', 'keyHash')).toBe(true);
		expect(await has('ever_connect_provision_result', 'completionNextAt')).toBe(true);
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new EverConnectProvision1791000003950();
			await migration.up(runner);
			await migration.down(runner);
			expect(await has('ever_connect_provision_intent')).toBe(false);
			expect(await has('ever_connect_provision_result')).toBe(false);
			expect(await has('ever_connect_connection', 'status')).toBe(true);
			expect(await has('ever_connect_person_request')).toBe(true);
			await migration.up(runner);
			expect(await has('ever_connect_provision_result')).toBe(true);
		} finally {
			await runner.release();
		}
	});

	it('the store on this database: retries under a new jti, the report moved to a new request, ended requests removed', async () => {
		const clock = { now: () => 1_000_000 };
		const store = new EverConnectProvisionStore(dataSource, clock);
		const until = clock.now() + 60_000;
		const first = { idempotencyKey: 'k1', jti: 'J1', everOrgId: 'O1' };
		expect((await store.claim(first, 'h1', until)).outcome).toBe('claimed');
		expect((await store.claim(first, 'h2', until)).outcome).toBe('busy');
		await store.fail('k1', 'h1', 'stopped');

		// Ever Platform's retry of the step: a new jti under the same key takes the creation over.
		const retry = await store.claim({ ...first, jti: 'J2' }, 'h2', until);
		expect(retry).toMatchObject({ outcome: 'claimed', record: { jti: 'J2', status: 'pending', claimedBy: 'h2' } });
		// The Ever organization is held, and a jti used under this key is no other key's.
		expect((await store.claim({ idempotencyKey: 'k2', jti: 'J3', everOrgId: 'O1' }, 'h3', until)).outcome).toBe(
			'org_linked'
		);
		expect((await store.claim({ idempotencyKey: 'k2', jti: 'J2', everOrgId: 'O2' }, 'h3', until)).outcome).toBe(
			'replayed'
		);

		await store.markCreated('k1', {
			productTenantId: 't1',
			productOrgId: 'o1',
			productUserId: 'u1',
			employeeId: null,
			teamId: null
		});
		expect((await store.claim({ ...first, jti: 'J9' }, 'h4', until)).outcome).toBe('created');

		// A report Ever Platform never answered moves to the new request; one it answered stays.
		expect(await store.leaseCompletion((await store.result('k1')) as never, until)).toBe(true);
		expect(await store.updateCompletion('k1', 0, { completionState: 'failed', completionError: '410_x' })).toBe(true);
		expect(await store.reportUnder('k1', 'J4')).toBe(true);
		expect(await store.result('k1')).toMatchObject({
			jti: 'J4',
			completionState: 'pending',
			completionAttempts: 0,
			completionNextAt: clock.now(),
			completionError: null
		});
		expect(await store.updateCompletion('k1', 0, { completedAt: clock.now() })).toBe(true);
		expect(await store.reportUnder('k1', 'J5')).toBe(false);

		// Ended requests go, except the one whose report is open.
		const save = (jti: string, expiresAt: number) =>
			store.saveIntent({ jti, intent: '{}', keyHash: jti, idempotencyKey: `key-${jti}`, expiresAt });
		await save('J4', 1);
		await save('J6', 1);
		await save('J7', clock.now() + 1);
		expect(await store.purgeEndedIntents(clock.now())).toBe(1);
		expect(await store.intent('J4')).not.toBeNull();
		expect(await store.intent('J6')).toBeNull();
		expect(await store.intent('J7')).not.toBeNull();
	});

	it('one row per key digest, and one result per jti', async () => {
		const intent = {
			intent: '{}',
			idempotencyKey: 'k1',
			status: 'pending',
			receivedAt: 1,
			expiresAt: 2,
			updatedAt: 1
		};
		await insert(dataSource, target.name, 'ever_connect_provision_intent', { jti: 'J1', keyHash: 'h1', ...intent });
		await expect(
			insert(dataSource, target.name, 'ever_connect_provision_intent', { jti: 'J2', keyHash: 'h1', ...intent })
		).rejects.toThrow();
		const result = { status: 'pending', createdAt: 1, updatedAt: 1 };
		await insert(dataSource, target.name, 'ever_connect_provision_result', {
			idempotencyKey: 'k1',
			jti: 'J1',
			...result
		});
		await expect(
			insert(dataSource, target.name, 'ever_connect_provision_result', {
				idempotencyKey: 'k2',
				jti: 'J1',
				...result
			})
		).rejects.toThrow();
		const [row] = await dataSource.query(
			`SELECT * FROM ${target.name === 'mysql' ? '`ever_connect_provision_result`' : '"ever_connect_provision_result"'}`
		);
		expect(Number(row['completionAttempts'])).toBe(0);
	});
});
