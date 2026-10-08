import { DataSource, Logger, QueryRunner } from 'typeorm';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { EverConnectCatalogService } from './ever-connect-catalog.service';
import { EverConnectSecretStore } from './ever-connect-secret-store';
import { EverConnectStore, LinkRecord, LiveLinkExistsError } from './ever-connect.store';
import {
	connectMigrations,
	CORE_TABLES,
	createCoreTables,
	dropTables,
	insert,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	q,
	seedTenant,
	TEST_TARGETS,
	TestDialect
} from './fixtures/test-db';

/**
 * The plugin's statements on real databases: the migration (up, up again, down, up), the
 * connection row and its compare-and-set operations, the integration states, the catalog row under
 * concurrent starts, the link record in Gauzy's integration tables, the audit, and what is stored
 * encrypted.
 */
const TABLES = PLUGIN_TABLES.filter((table) => table !== 'ever_instance').sort();

class RecordingLogger implements Logger {
	readonly queries: string[] = [];
	logQuery(query: string) {
		this.queries.push(query);
	}
	logQueryError() {
		/* only queries are recorded */
	}
	logQuerySlow() {
		/* only queries are recorded */
	}
	logSchemaBuild() {
		/* only queries are recorded */
	}
	logMigration() {
		/* only queries are recorded */
	}
	log() {
		/* only queries are recorded */
	}
}

async function tableNames(runner: QueryRunner, dialect: TestDialect): Promise<string[]> {
	const rows: Array<Record<string, string>> =
		dialect === 'postgres'
			? await runner.query(
					`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`
				)
			: dialect === 'mysql'
				? await runner.query(
						`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
					)
				: await runner.query(`SELECT name FROM sqlite_master WHERE type = 'table'`);
	return rows
		.map((row) => row['name'] ?? row['NAME'])
		.filter((name) => TABLES.includes(name))
		.sort();
}

jest.setTimeout(120_000);

describe.each(TEST_TARGETS)('EverConnect migration on $name', (target) => {
	let dataSource: DataSource;
	let logger: RecordingLogger;
	const d = target.name;

	beforeAll(async () => {
		logger = new RecordingLogger();
		const plain = await openTestDataSource(target);
		const options = { ...plain.options, logging: true, logger };
		await plain.destroy();
		dataSource = new DataSource(options as never);
		await dataSource.initialize();
		await dropTables(dataSource, d, PLUGIN_TABLES);
	});

	afterAll(async () => {
		await dropTables(dataSource, d, PLUGIN_TABLES);
		await dataSource.destroy();
	});

	async function run(direction: 'up' | 'down'): Promise<string[]> {
		logger.queries.length = 0;
		const runner = dataSource.createQueryRunner();
		const migration = connectMigrations()[1];
		try {
			if (d === 'postgres') await runner.startTransaction();
			await migration[direction](runner);
			if (d === 'postgres') await runner.commitTransaction();
		} catch (error) {
			if (runner.isTransactionActive) await runner.rollbackTransaction();
			throw error;
		} finally {
			await runner.release();
		}
		return logger.queries.filter(
			(query) => !/^(START TRANSACTION|BEGIN|COMMIT|SELECT pg_advisory_xact_lock)/i.test(query.trim())
		);
	}

	it('creates six tables, survives a second up, drops them, creates them again; touches nothing else', async () => {
		const first = await run('up');
		const runner = dataSource.createQueryRunner();
		expect(await tableNames(runner, d)).toEqual(TABLES);
		const second = await run('up');
		expect(second.length).toBe(first.length);
		expect(await tableNames(runner, d)).toEqual(TABLES);
		await run('down');
		expect(await tableNames(runner, d)).toEqual([]);
		await run('up');
		expect(await tableNames(runner, d)).toEqual(TABLES);
		await runner.release();
		for (const statement of first) {
			expect(statement).toMatch(/^(CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS|DROP TABLE IF EXISTS)/);
			expect(statement).not.toMatch(/\b(tenant|organization|user|role_permission|integration_tenant)"?\s*\(/i);
			expect(statement).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|REFERENCES|FOREIGN KEY)\b/i);
		}
		// One statement per table and index: none per tenant or row.
		expect(first.length).toBeLessThanOrEqual(d === 'mysql' ? 6 : 13);
	});
});

describe.each(TEST_TARGETS)('EverConnect store on $name', (target) => {
	let dataSource: DataSource;
	const d = target.name;
	let clock = 1_000_000;
	const now = { now: () => clock };

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
	});

	beforeEach(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		await migrateUp(dataSource);
		clock = 1_000_000;
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	it('creates the connection row once, disconnected, under concurrent first reads', async () => {
		const stores = Array.from({ length: 10 }, () => new EverConnectStore(dataSource, now));
		const rows = await Promise.all(stores.map((store) => store.connection()));
		expect(new Set(rows.map((row) => row.status))).toEqual(new Set(['disconnected']));
		const count = await dataSource.query(`SELECT COUNT(*) AS n FROM ${q(d, 'ever_connect_connection')}`);
		expect(Number(count[0].n)).toBe(1);
	});

	it('the lease: one holder at a time, renewable by it, free once expired', async () => {
		const store = new EverConnectStore(dataSource, now);
		expect(await store.takeLease('a', 60_000)).toBe(true);
		expect(await store.takeLease('b', 60_000)).toBe(false);
		expect(await store.takeLease('a', 60_000)).toBe(true);
		clock += 60_001;
		expect(await store.takeLease('b', 60_000)).toBe(true);
		expect(await store.takeLease('a', 60_000)).toBe(false);
		await store.releaseLease('b');
		expect(await store.takeLease('a', 60_000)).toBe(true);
	});

	it('EVER_CONNECT_CODE: one process claims an attempt (compare and set)', async () => {
		const store = new EverConnectStore(dataSource, now);
		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				new EverConnectStore(dataSource, now).claimEnvCodeAttempt(null, clock + 60_000)
			)
		);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect(await store.claimEnvCodeAttempt(null, clock + 60_000)).toBe(false);
		expect(await store.claimEnvCodeAttempt(clock + 60_000, clock + 120_000)).toBe(true);
	});

	it('integration states: one row per scope and key, updated in place', async () => {
		const store = new EverConnectStore(dataSource, now);
		await store.saveIntegration('instance', 'stats_link', {
			state: 'pending_operator',
			consentId: '01JD4M2N3P4Q5R6S7T8V9V0W1X'
		});
		await store.saveIntegration('instance', 'stats_link', { state: 'enabled', enabled: true });
		await store.saveIntegration(
			'01JD4M2N3P4Q5R6S7T8V9V0W1Y',
			'counterparty_lookup',
			{ state: 'coming_soon' },
			{ tenantId: 't', organizationId: 'o' }
		);
		const rows = await store.integrations();
		expect(rows.map((row) => [row.scope, row.name, row.state, row.enabled])).toEqual([
			['01JD4M2N3P4Q5R6S7T8V9V0W1Y', 'counterparty_lookup', 'coming_soon', false],
			['instance', 'stats_link', 'enabled', true]
		]);
		expect((await store.integration('instance', 'stats_link'))?.consentId).toBe('01JD4M2N3P4Q5R6S7T8V9V0W1X');
	});

	it('the catalog row is written once under concurrent starts, listed under All Integrations', async () => {
		await insert(dataSource, d, 'integration_type', { id: 'type-all', name: 'All Integrations' });
		const services = Array.from(
			{ length: d === 'better-sqlite3' ? 1 : 5 },
			() => new EverConnectCatalogService(dataSource)
		);
		await Promise.all(services.map((service) => service.ensure()));
		await new EverConnectCatalogService(dataSource).ensure();
		const rows = await dataSource.query(
			`SELECT * FROM ${q(d, 'integration')} WHERE ${q(d, 'name')} = 'Ever_Connect'`
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			provider: 'Ever_Connect',
			imgSrc: 'integrations/ever-platform.svg',
			redirectUrl: 'ever-connect'
		});
		const types = await dataSource.query(`SELECT * FROM ${q(d, 'integration_integration_type')}`);
		expect(types).toHaveLength(1);
	});

	it('a link record in Gauzy integration tables, archived on removal; membership check', async () => {
		const tenant = await seedTenant(dataSource, d, 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
		const store = new EverConnectStore(dataSource, now);
		expect(await store.isMember(tenant.tenantId, tenant.organizationId, tenant.superAdminId)).toBe(true);
		expect(await store.isMember(tenant.tenantId, tenant.organizationId, 'someone-else')).toBe(false);
		const id = await store.createLinkRecord(
			{ tenantId: tenant.tenantId, organizationId: tenant.organizationId },
			{ EVER_LINK_ID: '01JD4M2N3P4Q5R6S7T8V9V0W1X', EVER_LINK_STATUS: 'linked' }
		);
		const settings = await dataSource.query(
			`SELECT * FROM ${q(d, 'integration_setting')} WHERE ${q(d, 'integrationId')} = '${id}'`
		);
		expect(settings.map((row: Record<string, unknown>) => row['settingsName']).sort()).toEqual([
			'EVER_LINK_ID',
			'EVER_LINK_STATUS'
		]);
		await store.updateLinkRecordSettings(id, { EVER_LINK_STATUS: 'unlinked' });
		await store.archiveLinkRecord(id);
		const [row] = await dataSource.query(
			`SELECT * FROM ${q(d, 'integration_tenant')} WHERE ${q(d, 'id')} = '${id}'`
		);
		expect(Boolean(Number(row.isArchived))).toBe(true);
		expect(Boolean(Number(row.isActive))).toBe(false);
	});

	it('the audit adds rows only, pages them per organization, and the instance rows only for the operator', async () => {
		const audit = new EverConnectAuditService(dataSource, now);
		await audit.record({ action: 'instance.connect', actorLabel: 'operator', details: { status: 'connected' } });
		clock += 1;
		await audit.record({
			action: 'link.create',
			actorLabel: 'user',
			tenantId: 't1',
			organizationId: 'o1',
			details: { link_id: 'L1' }
		});
		clock += 1;
		await audit.record({
			action: 'link.create',
			actorLabel: 'user',
			tenantId: 't2',
			organizationId: 'o2',
			details: { link_id: 'L2' }
		});
		const tenant = await audit.list({
			tenantId: 't1',
			organizationId: 'o1',
			includeInstance: false,
			page: 1,
			limit: 10
		});
		expect(tenant.items.map((row) => row.action)).toEqual(['link.create']);
		const operator = await audit.list({
			tenantId: 't1',
			organizationId: 'o1',
			includeInstance: true,
			page: 1,
			limit: 10
		});
		expect(operator.items.map((row) => row.action)).toEqual(['link.create', 'instance.connect']);
		expect(operator.total).toBe(2);
	});

	const linkValues = (tenantId: string, organizationId: string, linkId: string) => ({
		tenantId,
		organizationId,
		integrationTenantId: null,
		linkId,
		everOrgId: '01JD4M2N3P4Q5R6S7T8V9V0EVR',
		everHandle: 'acme',
		status: 'linked' as const,
		entitlementJwsEncrypted: null,
		entitlementSeq: null,
		entitlementIat: null,
		entitlementExp: null,
		entitlementFetchedAt: null
	});

	it('one live link per organization, also under concurrent inserts; free again once unlinked', async () => {
		const tenant = await seedTenant(dataSource, d, 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
		const store = new EverConnectStore(dataSource, now);
		const results = await Promise.allSettled(
			['01JD4M2N3P4Q5R6S7T8V9V0LK1', '01JD4M2N3P4Q5R6S7T8V9V0LK2', '01JD4M2N3P4Q5R6S7T8V9V0LK3'].map((linkId) =>
				store.insertLink(linkValues(tenant.tenantId, tenant.organizationId, linkId))
			)
		);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		for (const result of results.filter((r) => r.status === 'rejected')) {
			expect((result as PromiseRejectedResult).reason).toBeInstanceOf(LiveLinkExistsError);
		}
		const live = (await store.linkOf(tenant.tenantId, tenant.organizationId)) as LinkRecord;
		await store.updateLink(live.linkId, { status: 'unlinked', unlinkedAt: clock });
		await expect(
			store.insertLink(linkValues(tenant.tenantId, tenant.organizationId, '01JD4M2N3P4Q5R6S7T8V9V0LK4'))
		).resolves.toMatchObject({ status: 'linked' });
	});

	it('a deleted organization or tenant: found, and its rows removed from every table (others kept)', async () => {
		const acme = await seedTenant(dataSource, d, 'Acme', '2026-01-01 00:00:00', 'ops@acme.example');
		const zephyr = await seedTenant(dataSource, d, 'Zephyr', '2026-02-01 00:00:00', 'ops@zephyr.example');
		const initech = await seedTenant(dataSource, d, 'Initech', '2026-03-01 00:00:00', 'ops@initech.example');
		const store = new EverConnectStore(dataSource, now);
		const audit = new EverConnectAuditService(dataSource, now);
		const owners = [acme, zephyr, initech];
		for (const [i, owner] of owners.entries()) {
			const linkId = `01JD4M2N3P4Q5R6S7T8V9V0LK${i}`;
			await store.insertLink(linkValues(owner.tenantId, owner.organizationId, linkId));
			await store.saveIntegration(linkId, 'counterparty_lookup', { state: 'coming_soon' }, owner);
			await insert(dataSource, d, 'ever_connect_lookup_cache', {
				id: `cache-${i}`,
				tenantId: owner.tenantId,
				organizationId: owner.organizationId,
				kind: 'email',
				hash: `hash-${i}`,
				saltVersion: 'v1',
				result: 'none',
				expiresAt: clock + 1
			});
			await audit.record({
				action: 'link.create',
				actorLabel: 'user',
				tenantId: owner.tenantId,
				organizationId: owner.organizationId,
				details: { link_id: linkId }
			});
		}
		expect(await store.deletedOwners()).toEqual([]);
		// Zephyr's organization is soft-deleted; Initech's tenant is deleted outright.
		await dataSource.query(
			`UPDATE ${q(d, 'organization')} SET ${q(d, 'deletedAt')} = ${d === 'better-sqlite3' ? "datetime('now')" : 'CURRENT_TIMESTAMP'} WHERE ${q(d, 'id')} = '${zephyr.organizationId}'`
		);
		await dataSource.query(`DELETE FROM ${q(d, 'tenant')} WHERE ${q(d, 'id')} = '${initech.tenantId}'`);
		const deleted = await store.deletedOwners();
		expect(deleted.map((owner) => owner.organizationId).sort()).toEqual(
			[zephyr.organizationId, initech.organizationId].sort()
		);
		for (const owner of deleted) {
			await store.purgeOwner(owner);
			await audit.purge(owner);
		}
		expect(await store.deletedOwners()).toEqual([]);
		for (const table of [
			'ever_connect_link',
			'ever_connect_integration',
			'ever_connect_lookup_cache',
			'ever_connect_audit'
		]) {
			const rows = await dataSource.query(`SELECT ${q(d, 'tenantId')} AS t FROM ${q(d, table)}`);
			expect([table, rows.map((row: { t: string }) => row.t)]).toEqual([table, [acme.tenantId]]);
		}
	});

	it('documents are stored encrypted: no compact JWS in any table (and a control store would leak)', async () => {
		const secrets = new EverConnectSecretStore({ ENCRYPTION_KEY: 'a-strong-encryption-key-for-tests' });
		// cspell:disable-next-line
		const jws = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJpbnN0YW5jZToxIn0.c2lnbmF0dXJl';
		const store = new EverConnectStore(dataSource, now);
		await store.updateConnection({ instanceEntitlementJwsEncrypted: secrets.seal(jws) });
		const dump = JSON.stringify(await dataSource.query(`SELECT * FROM ${q(d, 'ever_connect_connection')}`));
		expect(dump).not.toContain('eyJ');
		expect(secrets.open((await store.connection()).instanceEntitlementJwsEncrypted)).toBe(jws);
		// Another secret cannot read it: the document reads as missing (it is fetched again).
		expect(
			new EverConnectSecretStore({ ENCRYPTION_KEY: 'another-key' }).open(
				(await store.connection()).instanceEntitlementJwsEncrypted
			)
		).toBeNull();
		// Control: storing the document as it came would be found.
		await store.updateConnection({ instanceEntitlementJwsEncrypted: jws });
		expect(JSON.stringify(await dataSource.query(`SELECT * FROM ${q(d, 'ever_connect_connection')}`))).toContain(
			'eyJ'
		);
	});

	it('refuses to store a document without ENCRYPTION_KEY or a non-default JWT_SECRET', () => {
		expect(() => new EverConnectSecretStore({}).seal('x')).toThrow();
		expect(() => new EverConnectSecretStore({ JWT_SECRET: 'secretKey' }).seal('x')).toThrow();
		expect(new EverConnectSecretStore({ JWT_SECRET: 'a-strong-unique-secret' }).usable()).toBe(true);
	});
});
