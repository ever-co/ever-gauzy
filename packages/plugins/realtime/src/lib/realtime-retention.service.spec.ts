/**
 * Outbox retention of the collaboration events (spec FR-3, task T23), for real: the rows and the watermark live on an
 * in-memory better-sqlite3 store (the watermark table from the plugin's own migration), and the bounds are the
 * plugin's constants — 24 hours, and the newest 1,000 rows of each scope.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application): the entity decorators are
 * no-ops, and the entity classes are mapped onto the tables with schemas of their own.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ColumnIndex: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		EventOutbox: class EventOutbox {},
		SubscriptionCatalogue: class SubscriptionCatalogue {},
		matchesEventSelection: (selection: string, name: string) => selection === name
	};
	return new Proxy(explicit, {
		get: (target, name) =>
			name in target
				? target[name as string]
				: function Anything() {
						return undefined;
					}
	});
});
jest.mock('@gauzy/plugin-docs', () => ({ __esModule: true, DocumentService: class DocumentService {} }));

import { randomUUID } from 'node:crypto';
import { ModuleRef } from '@nestjs/core';
import { DataSource, EntitySchema, IsNull } from 'typeorm';
import { EventOutboxStatus } from '@gauzy/contracts';
import { EventOutbox } from '@gauzy/core';
import { CreateRealtimePresenceAndWatermarkTables1791000006820 } from './database/migrations/1791000006820-CreateRealtimePresenceAndWatermarkTables';
import { REALTIME_RETENTION_MIN_AGE_MS, REALTIME_RETENTION_MIN_EVENTS } from './realtime.constants';
import { RealtimeReplayWatermark } from './realtime.entities';
import { precedesWatermark } from './realtime-catch-up.service';
import { RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';
import { IRetentionBounds, RealtimeRetentionService } from './realtime-retention.service';

const TENANT = 'ten';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const NOW = new Date('2026-11-10T12:00:00.000Z');
const HOUR = 60 * 60_000;
const BOUNDS: IRetentionBounds = { minAgeMs: REALTIME_RETENTION_MIN_AGE_MS, minEvents: REALTIME_RETENTION_MIN_EVENTS, batch: 5_000, scopes: 50 };

interface IRow {
	id: string;
	tenantId: string | null;
	organizationId: string | null;
	eventId: string;
	eventName: string;
	status: string;
	createdAt: Date;
	partitionKey: string | null;
	sequence: number;
}

const OutboxSchema = new EntitySchema<IRow>({
	name: 'EventOutbox',
	target: EventOutbox,
	tableName: 'event_outbox',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		eventId: { type: 'varchar' },
		eventName: { type: 'varchar' },
		status: { type: 'varchar' },
		createdAt: { type: 'datetime' },
		partitionKey: { type: 'varchar', nullable: true },
		sequence: { type: 'integer' }
	}
});

const WatermarkSchema = new EntitySchema<RealtimeReplayWatermark>({
	name: 'RealtimeReplayWatermark',
	target: RealtimeReplayWatermark,
	tableName: 'realtime_replay_watermark',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		scopeKey: { type: 'varchar' },
		prunedAt: { type: 'datetime' },
		prunedEventId: { type: 'varchar' }
	}
} as never);

let dataSource: DataSource;
let watermarks: RealtimeReplayWatermarkService;
let retention: RealtimeRetentionService;

let partitions = 0;

/**
 * Rows of one scope: `count` of them, `spacingMs` apart (a minute), the newest `newestHoursAgo` hours before now — the
 * events of one aggregate (one partition, numbered in time order), so only the newest is its partition's head.
 */
function rowsOf(organizationId: string | null, count: number, newestHoursAgo: number, overrides: Partial<IRow> = {}, spacingMs = 60_000): IRow[] {
	const partitionKey = `task:${++partitions}`;
	return Array.from({ length: count }, (_, index) => ({
		partitionKey,
		sequence: index + 1,
		id: randomUUID(),
		tenantId: TENANT,
		organizationId,
		eventId: randomUUID(),
		eventName: 'task.updated',
		status: EventOutboxStatus.PUBLISHED,
		createdAt: new Date(NOW.getTime() - newestHoursAgo * HOUR - (count - 1 - index) * spacingMs),
		...overrides
	}));
}

async function insert(rows: IRow[]): Promise<void> {
	for (let start = 0; start < rows.length; start += 200) {
		await dataSource.getRepository(OutboxSchema).insert(rows.slice(start, start + 200));
	}
}

const left = async (organizationId: string | null) =>
	dataSource.getRepository(OutboxSchema).count({ where: { tenantId: TENANT, organizationId: organizationId ?? IsNull() } });

beforeAll(async () => {
	dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [OutboxSchema, WatermarkSchema], synchronize: false, logging: false });
	await dataSource.initialize();
	await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
	for (const id of [ORG_A, ORG_B]) await dataSource.query(`INSERT INTO "organization" ("id") VALUES (?)`, [id]);
	await dataSource.query(
		`CREATE TABLE "event_outbox" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "eventId" varchar NOT NULL, "eventName" varchar NOT NULL, "status" varchar NOT NULL, "createdAt" datetime NOT NULL, "partitionKey" varchar, "sequence" integer NOT NULL DEFAULT (0))`
	);
	const runner = dataSource.createQueryRunner();
	await new CreateRealtimePresenceAndWatermarkTables1791000006820().up(runner);
	await runner.release();
});

afterAll(async () => {
	await dataSource?.destroy();
});

beforeEach(async () => {
	await dataSource.query(`DELETE FROM "event_outbox"`);
	await dataSource.query(`DELETE FROM "realtime_replay_watermark"`);
	watermarks = new RealtimeReplayWatermarkService(dataSource);
	retention = new RealtimeRetentionService(dataSource, watermarks, { get: () => undefined } as unknown as ModuleRef);
});

describe('RealtimeRetentionService', () => {
	it('keeps the newest 1,000 events of a scope, however old, and removes the older ones', async () => {
		const rows = rowsOf(ORG_A, REALTIME_RETENTION_MIN_EVENTS + 5, 72);
		await insert(rows);
		const pass = await retention.prune(NOW, BOUNDS);
		expect(pass).toEqual({ removed: 5, scopes: [{ tenantId: TENANT, organizationId: ORG_A, removed: 5 }] });
		expect(await left(ORG_A)).toBe(REALTIME_RETENTION_MIN_EVENTS);
		// The watermark is the newest row removed: a cursor before it resyncs, one at the oldest kept row does not.
		const watermark = await watermarks.forScope(TENANT, ORG_A);
		expect(watermark).toEqual({ at: rows[4].createdAt.getTime(), eventId: rows[4].eventId });
		expect(precedesWatermark(watermark, rows[3].createdAt.getTime(), rows[3].eventId)).toBe(true);
		expect(precedesWatermark(watermark, rows[5].createdAt.getTime(), rows[5].eventId)).toBe(false);
	});

	it('keeps the last 24 hours, however many events they hold, and removes only what is older and beyond the 1,000', async () => {
		// 1,100 events in the last 24 hours, and 100 older ones (of another task, whose newest event stays: see below).
		await insert([...rowsOf(ORG_B, 100, 30), ...rowsOf(ORG_B, 1_100, 1)]);
		const pass = await retention.prune(NOW, BOUNDS);
		expect(pass.removed).toBe(99);
		expect(await left(ORG_B)).toBe(1_101);
		// Of what is older than 24 hours, only the older task's newest event is left.
		const kept = await dataSource.getRepository(OutboxSchema).find({ where: { organizationId: ORG_B }, order: { createdAt: 'ASC' }, take: 2 });
		expect(kept[0].sequence).toBe(100);
		expect(NOW.getTime() - kept[1].createdAt.getTime()).toBeLessThan(REALTIME_RETENTION_MIN_AGE_MS);
	});

	it('removes nothing from a scope within both bounds', async () => {
		await insert(rowsOf(ORG_A, 900, 72));
		// 2,000 events, all of the last 17 hours.
		await insert(rowsOf(ORG_B, 2_000, 0, {}, 30_000));
		expect(await retention.prune(NOW, BOUNDS)).toEqual({ removed: 0, scopes: [] });
		expect(await watermarks.forScope(TENANT, ORG_A)).toBeNull();
	});

	it('removes only dispatched collaboration events that carry a tenant, and counts every collaboration row of the scope', async () => {
		const old = rowsOf(ORG_A, 8, 96);
		old[0].status = EventOutboxStatus.PENDING;
		old[1].status = EventOutboxStatus.FAILED;
		old[2].status = EventOutboxStatus.DEAD;
		old[3].eventName = 'order.placed';
		const orphan = rowsOf(null, 3, 96, { tenantId: null });
		await insert([...old, ...orphan, ...rowsOf(ORG_A, REALTIME_RETENTION_MIN_EVENTS, 48)]);
		const pass = await retention.prune(NOW, BOUNDS);
		// Three old dispatched collaboration rows go (old[4..6]); the pending, failed and dead ones, the order event and the
		// task's newest event (old[7], its partition's head) stay.
		expect(pass.removed).toBe(3);
		const remaining = await dataSource.getRepository(OutboxSchema).find({ where: { organizationId: ORG_A }, order: { createdAt: 'ASC' }, take: 5 });
		expect(remaining.map((row) => row.id)).toEqual([...old.slice(0, 4), old[7]].map((row) => row.id));
		expect(await dataSource.getRepository(OutboxSchema).count({ where: { tenantId: IsNull() } })).toBe(3);
	});

	it('treats the tenant-wide events as a scope of their own', async () => {
		await insert([...rowsOf(null, REALTIME_RETENTION_MIN_EVENTS + 2, 72), ...rowsOf(ORG_A, 10, 72)]);
		const pass = await retention.prune(NOW, BOUNDS);
		expect(pass.scopes).toEqual([{ tenantId: TENANT, organizationId: null, removed: 2 }]);
		expect(await watermarks.forScope(TENANT, null)).not.toBeNull();
		// A caller of an organization reads the tenant-wide rows too: it sees that watermark.
		expect(await watermarks.forScope(TENANT, ORG_A)).toEqual(await watermarks.forScope(TENANT, null));
	});

	it('removes at most a batch per scope per pass, oldest first, and continues on the next pass', async () => {
		await insert(rowsOf(ORG_A, REALTIME_RETENTION_MIN_EVENTS + 5, 72));
		expect((await retention.prune(NOW, { ...BOUNDS, batch: 2 })).removed).toBe(2);
		expect((await retention.prune(NOW, { ...BOUNDS, batch: 2 })).removed).toBe(2);
		expect((await retention.prune(NOW, { ...BOUNDS, batch: 2 })).removed).toBe(1);
		expect((await retention.prune(NOW, { ...BOUNDS, batch: 2 })).removed).toBe(0);
		expect(await left(ORG_A)).toBe(REALTIME_RETENTION_MIN_EVENTS);
	});

	it('removes nothing when the watermark cannot be advanced (one transaction), and the next pass retries', async () => {
		await insert(rowsOf(ORG_A, REALTIME_RETENTION_MIN_EVENTS + 3, 72));
		const advance = jest.spyOn(watermarks, 'advance').mockRejectedValueOnce(new Error('database unavailable'));
		await expect(retention.prune(NOW, BOUNDS)).rejects.toThrow('database unavailable');
		expect(await left(ORG_A)).toBe(REALTIME_RETENTION_MIN_EVENTS + 3);
		expect(await watermarks.forScope(TENANT, ORG_A)).toBeNull();
		advance.mockRestore();
		// `run` logs a failed pass instead of throwing; the next one succeeds.
		expect((await retention.run(NOW))?.removed).toBe(3);
	});

	it("never removes a partition's newest row, so an aggregate's numbering never starts over", async () => {
		// A quiet task: its only events are the oldest of the organization, outside both bounds.
		const quiet = rowsOf(ORG_A, 3, 120);
		await insert([...quiet, ...rowsOf(ORG_A, REALTIME_RETENTION_MIN_EVENTS, 48)]);
		expect((await retention.prune(NOW, BOUNDS)).removed).toBe(2);
		const kept = await dataSource.getRepository(OutboxSchema).find({ where: { partitionKey: quiet[0].partitionKey as string } });
		expect(kept.map((row) => row.sequence)).toEqual([3]);
	});

	it('looks only at scopes past the window, so idle scopes never take a pass from one that needs it', async () => {
		const bounds = { ...BOUNDS, minEvents: 3, scopes: 2 };
		const orgs = ['org-1', 'org-2', 'org-3'];
		for (const id of orgs) await dataSource.query(`INSERT OR IGNORE INTO "organization" ("id") VALUES (?)`, [id]);
		// org-1 and org-2 hold old dispatched rows, but no more than the newest 3; org-3 (last in the order) is past it.
		await insert([...rowsOf('org-1', 3, 72), ...rowsOf('org-2', 2, 72), ...rowsOf('org-3', 6, 72)]);
		expect(await retention.prune(NOW, bounds)).toEqual({ removed: 3, scopes: [{ tenantId: TENANT, organizationId: 'org-3', removed: 3 }] });
	});

	it('goes through more scopes than one pass looks at, continuing where the previous pass stopped', async () => {
		const bounds = { ...BOUNDS, minEvents: 3, scopes: 2, batch: 1 };
		const orgs = ['org-4', 'org-5', 'org-6'];
		for (const id of orgs) await dataSource.query(`INSERT OR IGNORE INTO "organization" ("id") VALUES (?)`, [id]);
		await insert(orgs.flatMap((id) => rowsOf(id, 7, 72)));
		const touched = async () => (await retention.prune(NOW, bounds)).scopes.map((scope) => scope.organizationId);
		expect(await touched()).toEqual(['org-4', 'org-5']);
		expect(await touched()).toEqual(['org-6']);
		expect(await touched()).toEqual(['org-4', 'org-5']);
	});

	it('runs on a timer only when the switch is on', () => {
		jest.useFakeTimers();
		const previous = process.env['GAUZY_REALTIME_RETENTION_ENABLED'];
		try {
			const run = jest.spyOn(retention, 'run').mockResolvedValue(null);
			delete process.env['GAUZY_REALTIME_RETENTION_ENABLED'];
			retention.onModuleInit();
			jest.advanceTimersByTime(2 * HOUR);
			expect(run).not.toHaveBeenCalled();
			process.env['GAUZY_REALTIME_RETENTION_ENABLED'] = 'true';
			retention.onModuleInit();
			jest.advanceTimersByTime(HOUR);
			expect(run).toHaveBeenCalledTimes(1);
			retention.onModuleDestroy();
			jest.advanceTimersByTime(2 * HOUR);
			expect(run).toHaveBeenCalledTimes(1);
		} finally {
			if (previous === undefined) delete process.env['GAUZY_REALTIME_RETENTION_ENABLED'];
			else process.env['GAUZY_REALTIME_RETENTION_ENABLED'] = previous;
			jest.useRealTimers();
		}
	});
});
