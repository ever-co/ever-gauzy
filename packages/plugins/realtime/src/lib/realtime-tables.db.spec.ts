/**
 * The plugin's own tables, for real: the migration that creates them, per-connection presence
 * (`RealtimePresenceStore`) and the replay watermark (`RealtimeReplayWatermarkService`).
 *
 * The statements run on an in-memory better-sqlite3 store whose tables the plugin's migration creates (with stand-ins
 * for the platform tables its foreign keys name). `@gauzy/core` is doubled at the module boundary (its barrel boots
 * the whole application): the entity decorators are no-ops, and the entity classes are mapped onto the migrated tables
 * with schemas of their own.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ColumnIndex: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		Employee: class Employee {}
	};
});

import { DataSource, EntityManager, EntitySchema } from 'typeorm';
import { RealtimePresenceStatus } from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { CreateRealtimePresenceAndWatermarkTables1791000006820 } from './database/migrations/1791000006820-CreateRealtimePresenceAndWatermarkTables';
import { AddRealtimePresencePublication1791000006910 } from './database/migrations/1791000006910-AddRealtimePresencePublication';
import { REALTIME_PRESENCE_COALESCE_MS, REALTIME_PRESENCE_TTL_MS } from './realtime.constants';
import { RealtimePresence, REALTIME_PUBLISHED_PRESENCE_KEY, REALTIME_SHARED_CONNECTION_KEY, RealtimeReplayWatermark } from './realtime.entities';
import { IPresenceOutcome, isLive, mergePresence, RealtimePresenceStore } from './realtime-presence.store';
import { isLaterPosition, latestPosition, RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';

const TENANT = 'ten';
const ORG = 'org';
const ANNA = { employeeId: 'e-anna', userId: 'u-anna' };
const BOB = { employeeId: 'e-bob', userId: 'u-bob' };
const CARL = { employeeId: 'e-carl', userId: 'u-carl' };

/** The columns every plugin table carries, as the migration creates them. */
const baseColumns = {
	id: { primary: true, type: 'varchar', generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true }
} as const;

const PresenceSchema = new EntitySchema<RealtimePresence>({
	name: 'RealtimePresence',
	target: RealtimePresence,
	tableName: 'realtime_presence',
	columns: {
		...baseColumns,
		employeeId: { type: 'varchar' },
		userId: { type: 'varchar' },
		connectionId: { type: 'varchar' },
		status: { type: 'varchar' },
		expiresAt: { type: 'datetime', nullable: true },
		revision: { type: 'integer', default: 0 },
		publishedAt: { type: 'datetime', nullable: true },
		publishedRevision: { type: 'integer', default: 0 }
	}
} as never);

const WatermarkSchema = new EntitySchema<RealtimeReplayWatermark>({
	name: 'RealtimeReplayWatermark',
	target: RealtimeReplayWatermark,
	tableName: 'realtime_replay_watermark',
	columns: {
		...baseColumns,
		scopeKey: { type: 'varchar' },
		prunedAt: { type: 'datetime' },
		prunedEventId: { type: 'varchar' }
	}
} as never);

const EmployeeSchema = new EntitySchema<{ id: string; tenantId: string; lastSeenAt: Date | null; isIdle: boolean | null }>({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		lastSeenAt: { type: 'datetime', nullable: true },
		isIdle: { type: 'boolean', nullable: true }
	}
});

let dataSource: DataSource;

beforeAll(async () => {
	dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [PresenceSchema, WatermarkSchema, EmployeeSchema], synchronize: false, logging: false });
	await dataSource.initialize();
	await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "lastSeenAt" datetime, "isIdle" boolean)`);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
	await dataSource.query(`INSERT INTO "organization" ("id") VALUES (?)`, [ORG]);
	for (const employee of [ANNA, BOB, CARL]) {
		await dataSource.query(`INSERT INTO "employee" ("id", "tenantId") VALUES (?, ?)`, [employee.employeeId, TENANT]);
	}
	const runner = dataSource.createQueryRunner();
	await new CreateRealtimePresenceAndWatermarkTables1791000006820().up(runner);
	await new AddRealtimePresencePublication1791000006910().up(runner);
	await runner.release();
});

describe('AddRealtimePresencePublication1791000006910', () => {
	const columns = async (source: DataSource) =>
		((await source.query(`PRAGMA table_info("realtime_presence")`)) as Array<{ name: string }>).map((column) => column.name);

	it('adds the publication columns once, and drops them on the way down', async () => {
		const scratch = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await scratch.initialize();
		const runner = scratch.createQueryRunner();
		await new CreateRealtimePresenceAndWatermarkTables1791000006820().up(runner);
		const migration = new AddRealtimePresencePublication1791000006910();
		await migration.up(runner);
		await migration.up(runner);
		expect(await columns(scratch)).toEqual(expect.arrayContaining(['publishedAt', 'publishedRevision']));
		await migration.down(runner);
		expect(await columns(scratch)).not.toEqual(expect.arrayContaining(['publishedAt']));
		expect(await columns(scratch)).not.toContain('publishedRevision');
		await runner.release();
		await scratch.destroy();
	});
});

afterAll(async () => {
	await dataSource?.destroy();
});

describe('CreateRealtimePresenceAndWatermarkTables1791000006820', () => {
	const objects = async () =>
		((await dataSource.query(`SELECT "name" FROM "sqlite_master" WHERE "tbl_name" IN ('realtime_presence', 'realtime_replay_watermark') AND "type" IN ('table', 'index') AND "name" NOT LIKE 'sqlite_%' ORDER BY "name"`)) as Array<{ name: string }>).map((row) => row.name);

	it('creates both tables with their keys, and running it again changes nothing', async () => {
		const before = await objects();
		expect(before).toEqual(
			expect.arrayContaining(['realtime_presence', 'realtime_replay_watermark', 'UQ_realtime_presence_connection', 'IDX_realtime_presence_expires', 'UQ_realtime_replay_watermark_scope'])
		);
		const runner = dataSource.createQueryRunner();
		await new CreateRealtimePresenceAndWatermarkTables1791000006820().up(runner);
		await runner.release();
		expect(await objects()).toEqual(before);
	});

	it('refuses a second row for one connection of one employee', async () => {
		const row = `INSERT INTO "realtime_presence" ("id", "tenantId", "employeeId", "userId", "connectionId", "status") VALUES (?, ?, ?, ?, 'probe', 'active')`;
		await dataSource.query(row, ['p1', TENANT, ANNA.employeeId, ANNA.userId]);
		await expect(dataSource.query(row, ['p2', TENANT, ANNA.employeeId, ANNA.userId])).rejects.toThrow('UNIQUE constraint failed');
		await dataSource.query(`DELETE FROM "realtime_presence"`);
	});

	it('drops both tables on the way down', async () => {
		const scratch = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await scratch.initialize();
		const runner = scratch.createQueryRunner();
		const migration = new CreateRealtimePresenceAndWatermarkTables1791000006820();
		await migration.up(runner);
		await migration.down(runner);
		await runner.release();
		expect(await scratch.query(`SELECT "name" FROM "sqlite_master" WHERE "name" LIKE 'realtime_%'`)).toEqual([]);
		await scratch.destroy();
	});
});

describe('mergePresence', () => {
	it('is the most present connection: active, then idle, then away; offline with none', () => {
		expect(mergePresence(['away', 'active', 'idle'])).toBe(RealtimePresenceStatus.ACTIVE);
		expect(mergePresence(['away', 'idle'])).toBe(RealtimePresenceStatus.IDLE);
		expect(mergePresence(['away'])).toBe(RealtimePresenceStatus.AWAY);
		expect(mergePresence([])).toBe(RealtimePresenceStatus.OFFLINE);
		expect(mergePresence(['offline', 'unknown'])).toBe(RealtimePresenceStatus.OFFLINE);
	});

	it('counts a connection until it expires; one without an expiry never lapses', () => {
		const now = new Date('2026-11-09T12:00:00.000Z');
		expect(isLive({ expiresAt: new Date(now.getTime() + 1) }, now)).toBe(true);
		expect(isLive({ expiresAt: now }, now)).toBe(false);
		expect(isLive({ expiresAt: undefined }, now)).toBe(true);
	});
});

describe('RealtimePresenceStore', () => {
	let store: RealtimePresenceStore;
	const start = new Date('2026-11-09T12:00:00.000Z');
	const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);
	const report = (who: typeof ANNA, connectionId: string, status: RealtimePresenceStatus, seconds = 0) =>
		store.report({ tenantId: TENANT, organizationId: ORG, ...who, connectionId, status, now: at(seconds) });
	const employee = async (who: typeof ANNA) =>
		(await dataSource.query(`SELECT "lastSeenAt", "isIdle" FROM "employee" WHERE "id" = ?`, [who.employeeId]))[0] as { lastSeenAt: string | null; isIdle: number | null };
	const published = async (who: typeof ANNA) =>
		(await dataSource.query(`SELECT "status" FROM "realtime_presence" WHERE "employeeId" = ? AND "connectionId" = ?`, [who.employeeId, REALTIME_PUBLISHED_PRESENCE_KEY]))[0]?.status;
	/** A sweep, with the outcomes it handed over as each employee committed. */
	const sweep = async (moment: Date) => {
		const told: IPresenceOutcome[] = [];
		const counts = await store.sweep(moment, async (outcome) => void told.push(outcome));
		return { told, counts };
	};

	beforeEach(async () => {
		store = new RealtimePresenceStore(dataSource);
		await dataSource.query(`DELETE FROM "realtime_presence"`);
		await dataSource.query(`UPDATE "employee" SET "lastSeenAt" = NULL, "isIdle" = NULL`);
	});

	it('keeps an employee with two tabs present when one tab closes', async () => {
		expect(await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE)).toMatchObject({ status: 'active', changed: true });
		expect(await report(ANNA, 'tab-2', RealtimePresenceStatus.ACTIVE, 1)).toMatchObject({ status: 'active', changed: false });
		// The first tab closes: the second one still says active, so nothing changed for the organization.
		expect(await report(ANNA, 'tab-1', RealtimePresenceStatus.OFFLINE, 2)).toMatchObject({ status: 'active', changed: false });
		expect(await published(ANNA)).toBe('active');
		expect((await employee(ANNA)).isIdle).toBe(0);
		// The last tab closes: offline.
		expect(await report(ANNA, 'tab-2', RealtimePresenceStatus.OFFLINE, 3)).toMatchObject({ status: 'offline', changed: true });
		expect(await published(ANNA)).toBe('offline');
		expect((await employee(ANNA)).isIdle).toBe(1);
	});

	it('is as present as the most present tab: an idle or hidden tab does not mark an active employee idle', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		expect(await report(ANNA, 'tab-2', RealtimePresenceStatus.IDLE, 1)).toMatchObject({ status: 'active', changed: false });
		expect(await report(ANNA, 'tab-3', RealtimePresenceStatus.AWAY, 2)).toMatchObject({ status: 'active', changed: false });
		// The active tab goes idle: the most present one left is idle.
		expect(await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, 3)).toMatchObject({ status: 'idle', changed: true });
		expect(await report(ANNA, 'tab-2', RealtimePresenceStatus.AWAY, 4)).toMatchObject({ status: 'idle', changed: false });
		expect(await report(ANNA, 'tab-1', RealtimePresenceStatus.AWAY, 5)).toMatchObject({ status: 'away', changed: true });
		expect((await employee(ANNA)).isIdle).toBe(1);
		expect(await report(ANNA, 'tab-3', RealtimePresenceStatus.ACTIVE, 6)).toMatchObject({ status: 'active', changed: true });
		expect((await employee(ANNA)).isIdle).toBe(0);
	});

	it('keeps employees apart', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		expect(await report(BOB, 'tab-1', RealtimePresenceStatus.IDLE)).toMatchObject({ employeeId: BOB.employeeId, status: 'idle', changed: true });
		expect(await published(ANNA)).toBe('active');
	});

	it('records the last report on the employee (lastSeenAt), changed or not', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE, 30);
		expect(new Date(`${(await employee(ANNA)).lastSeenAt}Z`).toISOString()).toBe(at(30).toISOString());
	});

	it('lets a tab that stopped reporting lapse, and a sweep tells of it once', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE);
		await report(ANNA, 'tab-2', RealtimePresenceStatus.ACTIVE, 1);
		// tab-1 keeps reporting; tab-2 (the active one) crashed after its report at 1 s.
		const ttl = REALTIME_PRESENCE_TTL_MS / 1000;
		await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, ttl);
		expect((await sweep(at(ttl))).told).toEqual([]);
		const settled = await sweep(at(ttl + 1));
		expect(settled.told).toEqual([expect.objectContaining({ employeeId: ANNA.employeeId, status: 'idle', changed: true })]);
		expect(settled.counts).toEqual({ settled: 1, failed: 0 });
		expect(await published(ANNA)).toBe('idle');
		expect((await employee(ANNA)).isIdle).toBe(1);
		// Another process sweeping the same moment finds nothing left to settle.
		expect((await sweep(at(ttl + 1))).told).toEqual([]);
	});

	it('settles a crashed last tab as offline', async () => {
		await report(BOB, 'tab-1', RealtimePresenceStatus.ACTIVE);
		const settled = await sweep(at(REALTIME_PRESENCE_TTL_MS / 1000 + 1));
		expect(settled.told).toEqual([expect.objectContaining({ employeeId: BOB.employeeId, userId: BOB.userId, organizationId: ORG, status: 'offline', changed: true })]);
	});

	it('tells of each employee a sweep settled even when another employee’s settlement fails', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		await report(BOB, 'tab-1', RealtimePresenceStatus.ACTIVE, 1);
		await report(CARL, 'tab-1', RealtimePresenceStatus.ACTIVE, 2);
		// Bob's settlement (the second of three, in expiry order) fails after its writes: they roll back.
		const transaction = dataSource.transaction.bind(dataSource) as (work: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>;
		let calls = 0;
		const spy = jest.spyOn(dataSource, 'transaction').mockImplementation(((work: (manager: EntityManager) => Promise<unknown>) => {
			calls += 1;
			if (calls !== 2) return transaction(work);
			return transaction(async (manager) => {
				await work(manager);
				throw new Error('deadlock detected');
			});
		}) as never);
		try {
			const settled = await sweep(at(REALTIME_PRESENCE_TTL_MS / 1000 + 3));
			expect(settled.counts).toEqual({ settled: 2, failed: 1 });
			expect(settled.told.map((outcome) => [outcome.employeeId, outcome.status])).toEqual([
				[ANNA.employeeId, 'offline'],
				[CARL.employeeId, 'offline']
			]);
		} finally {
			spy.mockRestore();
		}
		// Bob's lapsed connection and published presence are as they were: the next pass settles and tells him.
		expect(await published(BOB)).toBe('active');
		expect((await sweep(at(REALTIME_PRESENCE_TTL_MS / 1000 + 4))).told).toEqual([expect.objectContaining({ employeeId: BOB.employeeId, status: 'offline', changed: true })]);
	});

	it('numbers the changes of an employee, and only the changes', async () => {
		expect((await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE)).revision).toBe(1);
		expect((await report(ANNA, 'tab-2', RealtimePresenceStatus.IDLE, 1)).revision).toBe(1);
		expect((await report(ANNA, 'tab-1', RealtimePresenceStatus.AWAY, 2)).revision).toBe(2);
		expect((await report(ANNA, 'tab-1', RealtimePresenceStatus.OFFLINE, 3)).revision).toBe(2);
		expect((await report(BOB, 'tab-1', RealtimePresenceStatus.ACTIVE, 3)).revision).toBe(1);
	});

	it('treats a report of a lapsed tab as that tab coming back', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		const late = REALTIME_PRESENCE_TTL_MS / 1000 + 10;
		// The organization was never told it lapsed (no sweep ran): nothing changed when it reports again.
		expect(await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE, late)).toMatchObject({ status: 'active', changed: false });
	});

	it('gives a client that names no connection one shared connection that never lapses, last report wins', async () => {
		await report(ANNA, REALTIME_SHARED_CONNECTION_KEY, RealtimePresenceStatus.ACTIVE);
		expect((await sweep(at(REALTIME_PRESENCE_TTL_MS / 1000 * 10))).told).toEqual([]);
		expect(await report(ANNA, REALTIME_SHARED_CONNECTION_KEY, RealtimePresenceStatus.IDLE, 1)).toMatchObject({ status: 'idle', changed: true });
		expect(await report(ANNA, REALTIME_SHARED_CONNECTION_KEY, RealtimePresenceStatus.OFFLINE, 2)).toMatchObject({ status: 'offline', changed: true });
	});

	describe('the publication window', () => {
		const claim = (who: typeof ANNA, seconds: number, from: RealtimePresenceStore = store) =>
			from.claimPublication({ tenantId: TENANT, employeeId: who.employeeId }, at(seconds));
		const window = REALTIME_PRESENCE_COALESCE_MS / 1000;

		it('tells a change at once, then holds the window and tells its latest change when it closes', async () => {
			await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
			expect(await claim(ANNA, 0)).toEqual(expect.objectContaining({ kind: 'publish', outcome: expect.objectContaining({ status: 'active', revision: 1 }) }));
			// Two more changes inside the window: nothing is told now, the asker is told when to come back.
			await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, 1);
			expect(await claim(ANNA, 1)).toEqual({ kind: 'later', at: at(window).getTime() });
			await report(ANNA, 'tab-1', RealtimePresenceStatus.AWAY, 2);
			expect(await claim(ANNA, 2)).toEqual({ kind: 'later', at: at(window).getTime() });
			// The window closes: the latest state is told, once.
			expect(await claim(ANNA, window)).toEqual(expect.objectContaining({ kind: 'publish', outcome: expect.objectContaining({ status: 'away', revision: 3 }) }));
			expect(await claim(ANNA, window)).toEqual({ kind: 'none' });
		});

		it('tells nothing when no revision is left untold', async () => {
			expect(await claim(BOB, 0)).toEqual({ kind: 'none' });
			await report(BOB, 'tab-1', RealtimePresenceStatus.ACTIVE);
			await claim(BOB, 0);
			expect(await claim(BOB, window * 3)).toEqual({ kind: 'none' });
		});

		it('lets one of two processes claiming at once win; the other comes back when the window closes', async () => {
			await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
			const other = new RealtimePresenceStore(dataSource);
			// The other process read the published row before this one's claim committed.
			const repository = dataSource.getRepository(RealtimePresence);
			const stale = await repository.findOne({ where: { tenantId: TENANT, employeeId: ANNA.employeeId, connectionId: REALTIME_PUBLISHED_PRESENCE_KEY } });
			expect(await claim(ANNA, 0)).toEqual(expect.objectContaining({ kind: 'publish' }));
			const read = jest.spyOn(repository, 'findOne').mockResolvedValueOnce(stale as never);
			try {
				expect(await claim(ANNA, 0, other)).toEqual({ kind: 'later', at: at(window).getTime() });
			} finally {
				read.mockRestore();
			}
		});

		it('tells a newer change after the window when a stale claim published an older one meanwhile', async () => {
			await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
			const repository = dataSource.getRepository(RealtimePresence);
			const stale = await repository.findOne({ where: { tenantId: TENANT, employeeId: ANNA.employeeId, connectionId: REALTIME_PUBLISHED_PRESENCE_KEY } });
			// A newer report commits while a claim that read the row before it is still in flight.
			await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, 1);
			const read = jest.spyOn(repository, 'findOne').mockResolvedValueOnce(stale as never);
			try {
				// The stale claim wins and publishes the older revision...
				expect(await claim(ANNA, 1)).toEqual(expect.objectContaining({ kind: 'publish', outcome: expect.objectContaining({ status: 'active', revision: 1 }) }));
			} finally {
				read.mockRestore();
			}
			// ...so the newer report's own announcement is held to the window, and told when it closes.
			expect(await claim(ANNA, 2)).toEqual({ kind: 'later', at: at(1 + window).getTime() });
			expect(await claim(ANNA, 1 + window)).toEqual(expect.objectContaining({ kind: 'publish', outcome: expect.objectContaining({ status: 'idle', revision: 2 }) }));
		});

		it('gives a won claim back so the revision is untold again, and never undoes a later claim', async () => {
			await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
			const won = await claim(ANNA, 0);
			if (won.kind !== 'publish') throw new Error('expected a won claim');
			expect(await store.release(won.claim)).toBe(true);
			expect(await store.untold(at(window))).toEqual([{ tenantId: TENANT, employeeId: ANNA.employeeId }]);
			// Claimed again (by another process); giving back the first claim now changes nothing.
			const again = await claim(ANNA, window);
			expect(again.kind).toBe('publish');
			expect(await store.release(won.claim)).toBe(false);
			expect(await claim(ANNA, window * 2)).toEqual({ kind: 'none' });
		});

		it('names the employees whose latest change no process told, once their window closed', async () => {
			await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
			await claim(ANNA, 0);
			await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, 1);
			await report(BOB, 'tab-1', RealtimePresenceStatus.ACTIVE, 1);
			// Bob was never told; Anna's change waits for her window.
			expect(await store.untold(at(2))).toEqual([{ tenantId: TENANT, employeeId: BOB.employeeId }]);
			expect((await store.untold(at(window))).map((scope) => scope.employeeId).sort()).toEqual([ANNA.employeeId, BOB.employeeId].sort());
		});
	});

	it('tells of a change once when two tabs report it at the same moment (the second merge sees the first)', async () => {
		await report(ANNA, 'tab-1', RealtimePresenceStatus.ACTIVE);
		await report(ANNA, 'tab-2', RealtimePresenceStatus.ACTIVE);
		// Both tabs go idle at the same moment. Each report locks the employee's published row first, so on Postgres and
		// MySQL the second waits for the first and merges after it; SQLite has one writer at a time.
		const first = await report(ANNA, 'tab-1', RealtimePresenceStatus.IDLE, 1);
		const second = await report(ANNA, 'tab-2', RealtimePresenceStatus.IDLE, 1);
		expect([first, second]).toEqual([expect.objectContaining({ status: 'active', changed: false }), expect.objectContaining({ status: 'idle', changed: true })]);
		expect(await published(ANNA)).toBe('idle');
	});
});

describe('RealtimeReplayWatermarkService', () => {
	let service: RealtimeReplayWatermarkService;
	const position = (iso: string, eventId: string) => ({ at: new Date(iso).getTime(), eventId });

	beforeEach(async () => {
		service = new RealtimeReplayWatermarkService(dataSource);
		await dataSource.query(`DELETE FROM "realtime_replay_watermark"`);
	});

	it('answers no watermark while nothing was removed', async () => {
		expect(await service.forScope(TENANT, ORG)).toBeNull();
		expect(await service.forScope(TENANT, null)).toBeNull();
	});

	it('answers the latest of the organization’s and the tenant-wide watermark, and only the tenant-wide one without an organization', async () => {
		await dataSource.transaction((manager) => service.advance(manager, { tenantId: TENANT, organizationId: ORG }, position('2026-11-01T00:00:00.000Z', 'e-org')));
		await dataSource.transaction((manager) => service.advance(manager, { tenantId: TENANT, organizationId: null }, position('2026-11-02T00:00:00.000Z', 'e-tenant')));
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-02T00:00:00.000Z', 'e-tenant'));
		expect(await service.forScope(TENANT, null)).toEqual(position('2026-11-02T00:00:00.000Z', 'e-tenant'));
		expect(await service.forScope('other-tenant', ORG)).toBeNull();
	});

	it('only ever moves forward, by time then event id, keeping one row per scope', async () => {
		const scope = { tenantId: TENANT, organizationId: ORG };
		const advance = (iso: string, eventId: string) => dataSource.transaction((manager) => service.advance(manager, scope, position(iso, eventId)));
		await advance('2026-11-03T00:00:00.000Z', 'b');
		await advance('2026-11-02T00:00:00.000Z', 'z');
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-03T00:00:00.000Z', 'b'));
		await advance('2026-11-03T00:00:00.000Z', 'a');
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-03T00:00:00.000Z', 'b'));
		await advance('2026-11-03T00:00:00.000Z', 'c');
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-03T00:00:00.000Z', 'c'));
		await advance('2026-11-04T00:00:00.000Z', 'a');
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-04T00:00:00.000Z', 'a'));
		expect(await dataSource.query(`SELECT COUNT(*) AS "rows" FROM "realtime_replay_watermark"`)).toEqual([{ rows: 1 }]);
	});

	it('leaves the later position whichever of two retentions commits last', async () => {
		const scope = { tenantId: TENANT, organizationId: ORG };
		// The later retention commits first; the earlier one, committing after it, must not move the watermark back.
		await dataSource.transaction((manager) => service.advance(manager, scope, position('2026-11-05T00:00:00.000Z', 'later')));
		await dataSource.transaction((manager) => service.advance(manager, scope, position('2026-11-04T00:00:00.000Z', 'earlier')));
		expect(await service.forScope(TENANT, ORG)).toEqual(position('2026-11-05T00:00:00.000Z', 'later'));
	});

	it('commits with the retention that removed the rows, or not at all', async () => {
		await expect(
			dataSource.transaction(async (manager) => {
				await service.advance(manager, { tenantId: TENANT, organizationId: ORG }, position('2026-11-04T00:00:00.000Z', 'e'));
				throw new Error('the removal failed');
			})
		).rejects.toThrow('the removal failed');
		expect(await service.forScope(TENANT, ORG)).toBeNull();
	});

	it('orders positions by time, then event id', () => {
		expect(isLaterPosition({ at: 2, eventId: 'a' }, { at: 1, eventId: 'z' })).toBe(true);
		expect(isLaterPosition({ at: 1, eventId: 'b' }, { at: 1, eventId: 'a' })).toBe(true);
		expect(isLaterPosition({ at: 1, eventId: 'a' }, { at: 1, eventId: 'a' })).toBe(false);
		expect(isLaterPosition({ at: 1, eventId: 'a' }, null)).toBe(true);
		expect(latestPosition([])).toBeNull();
		expect(latestPosition([{ at: 1, eventId: 'b' }, { at: 3, eventId: 'a' }, { at: 2, eventId: 'c' }])).toEqual({ at: 3, eventId: 'a' });
	});
});
