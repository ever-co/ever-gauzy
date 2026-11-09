/**
 * The catch-up after a reconnect: which rows it answers, and the position it tells the client to resume from.
 *
 * `@gauzy/core` and `@gauzy/plugin-docs` are doubled at the module boundary (their barrels boot the whole
 * application); the catch-up reads the outbox through the service's own read, which the interleaving case runs on
 * real SQLite transactions.
 */
jest.mock('@gauzy/core', () => {
	const explicit: Record<string, unknown> = {
		__esModule: true,
		EventOutboxService: class EventOutboxService {},
		// The plugin's entities load with the services: their decorators are no-ops here.
		MultiORMColumn: () => () => undefined,
		MultiORMEntity: () => () => undefined,
		ColumnIndex: () => () => undefined,
		SubscriptionCatalogue: class SubscriptionCatalogue {},
		RequestContext: { currentUserId: () => 'u1', currentTenantId: () => 'ten', currentOrganizationId: () => 'org' },
		matchesEventSelection: (selection: string, name: string) => selection === name
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});
jest.mock('@gauzy/plugin-docs', () => ({ __esModule: true, DocumentService: class DocumentService {} }));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EventOutboxService } from '@gauzy/core';
import { REALTIME_CATCH_UP_HORIZON_REUSE_MS, REALTIME_CATCH_UP_MAX_HOLD_MS, REALTIME_CATCH_UP_SETTLE_MS } from './realtime.constants';
import { RealtimeAudience } from './realtime-audience';
import { admitsRow, afterCursor, CatchUpRow, precedesWatermark, RealtimeCatchUpService, RealtimeSettleHorizon, selectCatchUp, settleHorizon } from './realtime-catch-up.service';
import { RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';

function row(partial: Partial<CatchUpRow> & { eventId: string; at: number }): CatchUpRow {
	return {
		eventId: partial.eventId,
		eventName: partial.eventName ?? 'task.updated',
		aggregateType: partial.aggregateType ?? 'task',
		aggregateId: partial.aggregateId ?? 'a1',
		createdAt: new Date(partial.at),
		sequence: partial.sequence ?? 1,
		payload: partial.payload ?? { entity: 'Task', entityId: 'a1', action: 'updated' }
	} as CatchUpRow;
}

/** A horizon past every row below: all of them have settled. */
const settled = { truncated: false, resync: false, horizon: 10_000 };

describe('admitsRow', () => {
	it('admits an organization-wide row to anyone of the scope', () => {
		expect(admitsRow(row({ eventId: 'e', at: 1 }), 'u1')).toBe(true);
		expect(admitsRow(row({ eventId: 'e', at: 1 }), null)).toBe(true);
	});

	it('admits an addressed row to its recipients only', () => {
		const addressed = row({ eventId: 'e', at: 1, payload: { recipientUserIds: ['u1'] } });
		expect(admitsRow(addressed, 'u1')).toBe(true);
		expect(admitsRow(addressed, 'u2')).toBe(false);
		expect(admitsRow(addressed, null)).toBe(false);
	});
});

describe('afterCursor', () => {
	it('is inclusive at the cursor time without an id, and exact with one', () => {
		const same = row({ eventId: 'b', at: 1000 });
		expect(afterCursor(same, 1000, null)).toBe(true);
		expect(afterCursor(same, 1000, 'a')).toBe(true);
		expect(afterCursor(same, 1000, 'b')).toBe(false);
		expect(afterCursor(same, 1000, 'c')).toBe(false);
		expect(afterCursor(same, 999, 'z')).toBe(true);
		expect(afterCursor(same, 1001, null)).toBe(false);
	});
});

describe('settleHorizon', () => {
	it('stays the settle window behind now', () => {
		expect(settleHorizon(50_000)).toBe(50_000 - REALTIME_CATCH_UP_SETTLE_MS);
	});
});

describe('RealtimeSettleHorizon', () => {
	const NOW = 10_000_000;
	const over = (type: string, query: jest.Mock) => new RealtimeSettleHorizon({ options: { type }, query } as unknown as DataSource);

	it('stays behind the oldest transaction open on Postgres (a row it appends is stamped with its start)', async () => {
		const query = jest.fn(async () => [{ age: '25000.5' }]);
		// Whole milliseconds, rounded down (the client sends the cursor back as an integer `after`).
		expect(await over('postgres', query).horizon(NOW)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS - 25_001);
		expect(String(query.mock.calls[0])).toContain('pg_stat_activity');
	});

	it('is held back no further than the cap by a forgotten transaction', async () => {
		const query = jest.fn(async () => [{ age: 86_400_000 }]);
		expect(await over('postgres', query).horizon(NOW)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS - REALTIME_CATCH_UP_MAX_HOLD_MS);
	});

	it('is the settle window alone without an open transaction, when the read fails, and off Postgres', async () => {
		expect(await over('postgres', jest.fn(async () => [{ age: null }])).horizon(NOW)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS);
		expect(await over('postgres', jest.fn(async () => Promise.reject(new Error('permission denied')))).horizon(NOW)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS);
		const sqlite = jest.fn();
		expect(await over('better-sqlite3', sqlite).horizon(NOW)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS);
		expect(sqlite).not.toHaveBeenCalled();
	});

	it('serves concurrent catch-ups with one read, and reuses it briefly (an earlier horizon is never later)', async () => {
		let release: (rows: unknown) => void = () => undefined;
		const query = jest.fn(() => new Promise((resolve) => (release = resolve)));
		const horizons = over('postgres', query);
		const first = horizons.horizon(NOW);
		const second = horizons.horizon(NOW + 5);
		release([{ age: 2_000 }]);
		expect(await Promise.all([first, second])).toEqual([NOW - REALTIME_CATCH_UP_SETTLE_MS - 2_000, NOW - REALTIME_CATCH_UP_SETTLE_MS - 2_000]);
		expect(query).toHaveBeenCalledTimes(1);
		// Within the reuse window: the earlier horizon still serves.
		expect(await horizons.horizon(NOW + REALTIME_CATCH_UP_HORIZON_REUSE_MS - 1)).toBe(NOW - REALTIME_CATCH_UP_SETTLE_MS - 2_000);
		expect(query).toHaveBeenCalledTimes(1);
		// After it: read again.
		query.mockImplementationOnce(async () => [{ age: null }]);
		expect(await horizons.horizon(NOW + REALTIME_CATCH_UP_HORIZON_REUSE_MS)).toBe(NOW + REALTIME_CATCH_UP_HORIZON_REUSE_MS - REALTIME_CATCH_UP_SETTLE_MS);
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('logs a failing read at most once a minute', async () => {
		const query = jest.fn(async () => Promise.reject(new Error('connection refused')));
		const horizons = over('postgres', query);
		const warn = jest.spyOn(horizons['logger'], 'warn').mockImplementation(() => undefined);
		for (const at of [NOW, NOW + 2_000, NOW + 30_000]) await horizons.horizon(at);
		expect(warn).toHaveBeenCalledTimes(1);
		await horizons.horizon(NOW + 60_000);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(query).toHaveBeenCalledTimes(4);
	});
});

describe('selectCatchUp', () => {
	const rows = [
		row({ eventId: 'e1', at: 1000 }),
		row({ eventId: 'e2', at: 2000, payload: { recipientUserIds: ['u2'] } }),
		row({ eventId: 'e3', at: 3000 }),
		row({ eventId: 'e4', at: 3000 }),
		row({ eventId: 'e5', at: 4000 })
	];

	it('answers everything after the cursor, oldest first, and resumes from the horizon once all was read', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 3000 }, settled);
		expect(answer.events.map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5']);
		// Every row stamped before the horizon was read: the position is the horizon itself, a time without an id.
		expect(answer.cursor).toBe(10_000);
		expect(answer.cursorId).toBeNull();
		expect(answer.hasMore).toBe(false);
		expect(answer.resync).toBe(false);
	});

	it('walks a same-millisecond group page by page without repeating or skipping', () => {
		const first = selectCatchUp(rows, 'u1', { after: 1000, afterId: 'e1', limit: 1 }, settled);
		expect(first.events.map((e) => e.eventId)).toEqual(['e3']);
		expect([first.cursor, first.cursorId, first.hasMore]).toEqual([3000, 'e3', true]);
		const second = selectCatchUp(rows, 'u1', { after: first.cursor ?? 0, afterId: first.cursorId ?? undefined, limit: 1 }, settled);
		expect(second.events.map((e) => e.eventId)).toEqual(['e4']);
		const third = selectCatchUp(rows, 'u1', { after: second.cursor ?? 0, afterId: second.cursorId ?? undefined, limit: 1 }, settled);
		expect(third.events.map((e) => e.eventId)).toEqual(['e5']);
		expect(third.hasMore).toBe(false);
	});

	it('withholds addressed rows from a non-recipient and strips the recipient list for a recipient', () => {
		expect(selectCatchUp(rows, 'u1', { after: 0 }, settled).events.map((e) => e.eventId)).not.toContain('e2');
		const forRecipient = selectCatchUp(rows, 'u2', { after: 2000, limit: 1 }, settled);
		expect(forRecipient.events[0].eventId).toBe('e2');
		expect(forRecipient.events[0].data).toEqual({});
	});

	it('starts a client without a cursor from the horizon, with nothing to apply', () => {
		const answer = selectCatchUp(rows, 'u1', { limit: 2 }, { ...settled, horizon: 7777 });
		expect(answer).toEqual({ events: [], cursor: 7777, cursorId: null, hasMore: false, resync: false });
	});

	it('reports a resync and a truncated read as the caller stated them', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 1000, limit: 4 }, { truncated: true, resync: true, horizon: 10_000 });
		expect(answer.resync).toBe(true);
		expect(answer.hasMore).toBe(true);
		expect([answer.cursor, answer.cursorId]).toEqual([4000, 'e5']);
	});

	it('walks past a window of rows the caller cannot see instead of stalling on it', () => {
		const hidden = [1000, 2000, 3000, 4000].map((at, index) => row({ eventId: `h${index + 1}`, at, payload: { recipientUserIds: ['u2'] } }));
		// The read window (4 rows) held nothing for u1 and was cut: the cursor moves to its end, and more follows.
		const first = selectCatchUp(hidden, 'u1', { after: 0, limit: 1 }, { ...settled, truncated: true });
		expect(first.events).toEqual([]);
		expect([first.cursor, first.cursorId, first.hasMore]).toEqual([4000, 'h4', true]);
		const second = selectCatchUp([...hidden, row({ eventId: 'v1', at: 5000 })], 'u1', { after: first.cursor ?? 0, afterId: first.cursorId ?? undefined, limit: 1 }, settled);
		expect(second.events.map((e) => e.eventId)).toEqual(['v1']);
		expect(second.hasMore).toBe(false);
	});

	it('keeps a cursor that is already past the horizon (one a streamed event gave) when nothing is new', () => {
		const quiet = selectCatchUp(rows, 'u1', { after: 12_000, afterId: 'zz' }, settled);
		expect(quiet.events).toEqual([]);
		expect([quiet.cursor, quiet.cursorId]).toEqual([12_000, 'zz']);
	});

	describe('the settle horizon', () => {
		it('answers the rows past the horizon but never resumes past it: they are answered again next time', () => {
			// Rows at 3000 and 4000 are newer than the horizon (2500): a row stamped before them may still commit.
			const answer = selectCatchUp(rows, 'u1', { after: 1000, afterId: 'e1' }, { ...settled, horizon: 2500 });
			expect(answer.events.map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5']);
			expect([answer.cursor, answer.cursorId, answer.hasMore]).toEqual([2500, null, false]);
			const again = selectCatchUp(rows, 'u1', { after: answer.cursor ?? 0, afterId: answer.cursorId ?? undefined }, { ...settled, horizon: 2500 });
			expect(again.events.map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5']);
		});

		it('pages normally up to the horizon, and stops paging at it', () => {
			const horizon = { ...settled, horizon: 3500 };
			const first = selectCatchUp(rows, 'u1', { after: 0, limit: 2 }, horizon);
			expect(first.events.map((e) => e.eventId)).toEqual(['e1', 'e3']);
			expect([first.cursor, first.cursorId, first.hasMore]).toEqual([3000, 'e3', true]);
			// The full page reaches past the horizon: everything before it was answered; the rest waits.
			const second = selectCatchUp(rows, 'u1', { after: first.cursor ?? 0, afterId: first.cursorId ?? undefined, limit: 2 }, horizon);
			expect(second.events.map((e) => e.eventId)).toEqual(['e4', 'e5']);
			expect([second.cursor, second.cursorId, second.hasMore]).toEqual([3500, null, false]);
		});
	});
});

describe('precedesWatermark', () => {
	const watermark = { at: 3000, eventId: 'e3' };

	it('says resync only when a removed row may be one the client did not apply', () => {
		expect(precedesWatermark(null, 0, null)).toBe(false);
		expect(precedesWatermark(watermark, 2999, 'zz')).toBe(true);
		expect(precedesWatermark(watermark, 3000, 'e2')).toBe(true);
		// The client applied the removed row itself, or a later one.
		expect(precedesWatermark(watermark, 3000, 'e3')).toBe(false);
		expect(precedesWatermark(watermark, 3001, null)).toBe(false);
		// A time-only cursor has not applied the rows stamped at that time.
		expect(precedesWatermark(watermark, 3000, null)).toBe(true);
	});
});

describe('RealtimeCatchUpService', () => {
	const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
	let clock: jest.SpyInstance<number, []>;

	/** The service over an outbox read and a watermark; every row admitted by the audience checks. */
	function serviceOver(
		read: (query: { eventNames?: readonly string[]; since?: Date; limit: number }) => Promise<CatchUpRow[]>,
		watermark: { at: number; eventId: string } | null = null,
		horizons?: RealtimeSettleHorizon
	) {
		const outbox = { listOutboxRowsSince: jest.fn(read) };
		const moduleRef = { get: (token: unknown) => (token === EventOutboxService ? outbox : undefined) } as unknown as ModuleRef;
		const audience = { admitted: jest.fn(async (events: unknown[]) => events.map(() => true)) } as unknown as RealtimeAudience;
		const watermarks = { forScope: jest.fn(async () => watermark) } as unknown as RealtimeReplayWatermarkService & { forScope: jest.Mock };
		return { service: new RealtimeCatchUpService(moduleRef, audience, watermarks, horizons), outbox, watermarks };
	}

	beforeEach(() => {
		clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
	});

	afterEach(() => {
		clock.mockRestore();
	});

	it('answers resync from the watermark of the caller’s scope only', async () => {
		const rows = [row({ eventId: 'e5', at: NOW - 60_000 })];
		const lost = serviceOver(async () => rows, { at: NOW - 120_000, eventId: 'gone' });
		expect((await lost.service.catchUp({ after: NOW - 180_000 })).resync).toBe(true);
		expect(lost.watermarks.forScope).toHaveBeenCalledWith('ten', 'org');
		expect((await lost.service.catchUp({ after: NOW - 100_000 })).resync).toBe(false);
	});

	it('never answers resync while nothing was removed — not for an empty scope, nor for a cursor older than its first row', async () => {
		const empty = serviceOver(async () => []);
		expect(await empty.service.catchUp({ after: NOW - 86_400_000 })).toMatchObject({ events: [], resync: false });
		const young = serviceOver(async () => [row({ eventId: 'first', at: NOW - 30_000 })]);
		expect(await young.service.catchUp({ after: NOW - 86_400_000 })).toMatchObject({ events: [expect.objectContaining({ eventId: 'first' })], resync: false });
	});

	it('reads the watermark after the rows, so a retention committing in between answers resync', async () => {
		const order: string[] = [];
		const outbox = { listOutboxRowsSince: jest.fn(async () => (order.push('rows'), [])) };
		const moduleRef = { get: (token: unknown) => (token === EventOutboxService ? outbox : undefined) } as unknown as ModuleRef;
		const watermarks = { forScope: jest.fn(async () => (order.push('watermark'), null)) } as unknown as RealtimeReplayWatermarkService;
		await new RealtimeCatchUpService(moduleRef, {} as RealtimeAudience, watermarks).catchUp({ after: NOW - 60_000 });
		expect(order).toEqual(['rows', 'watermark']);
	});

	it('answers a position held behind the open transactions when it knows them', async () => {
		const horizons = { horizon: jest.fn(async () => NOW - 120_000) } as unknown as RealtimeSettleHorizon;
		const { service } = serviceOver(async () => [], null, horizons);
		expect(await service.catchUp({ after: NOW - 600_000 })).toMatchObject({ cursor: NOW - 120_000, cursorId: null });
	});

	it('starts a client without a cursor from the horizon, reading nothing', async () => {
		const { service, outbox } = serviceOver(async () => []);
		expect(await service.catchUp({})).toEqual({ events: [], cursor: NOW - REALTIME_CATCH_UP_SETTLE_MS, cursorId: null, hasMore: false, resync: false });
		expect(outbox.listOutboxRowsSince).not.toHaveBeenCalled();
	});

	/**
	 * Two transactions append to the outbox and commit out of stamp order — A stamps its row first (Postgres stamps
	 * `createdAt` with the transaction's start), B stamps later and commits first — and a catch-up runs between the two
	 * commits. The transactions are real: two connections to one SQLite file, and a third that reads.
	 */
	describe('two transactions committing out of stamp order', () => {
		const file = path.join(os.tmpdir(), `realtime-catch-up-${randomUUID()}.sqlite`);
		const writerA = new DataSource({ type: 'better-sqlite3', database: file, logging: false });
		const writerB = new DataSource({ type: 'better-sqlite3', database: file, logging: false });
		const reader = new DataSource({ type: 'better-sqlite3', database: file, logging: false });

		beforeAll(async () => {
			for (const source of [writerA, writerB, reader]) await source.initialize();
			await reader.query(`PRAGMA journal_mode = WAL`);
			await reader.query(
				`CREATE TABLE "outbox" ("eventId" varchar PRIMARY KEY NOT NULL, "eventName" varchar NOT NULL, "aggregateId" varchar NOT NULL, "createdAtMs" integer NOT NULL, "payload" text NOT NULL)`
			);
		});

		afterAll(async () => {
			for (const source of [writerA, writerB, reader]) if (source.isInitialized) await source.destroy();
			for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
		});

		/** The outbox read the catch-up makes (its names, its time bound, its order and its bound), on the committed rows. */
		const committedRows = async (query: { eventNames?: readonly string[]; since?: Date; limit: number }): Promise<CatchUpRow[]> => {
			const found = (await reader.query(`SELECT * FROM "outbox" WHERE "createdAtMs" >= ? ORDER BY "createdAtMs", "eventId" LIMIT ?`, [
				query.since?.getTime() ?? 0,
				query.limit
			])) as Array<{ eventId: string; eventName: string; aggregateId: string; createdAtMs: number; payload: string }>;
			return found
				.filter((found) => !query.eventNames || query.eventNames.includes(found.eventName))
				.map((found) => row({ eventId: found.eventId, at: found.createdAtMs, eventName: found.eventName, aggregateId: found.aggregateId, payload: JSON.parse(found.payload) }));
		};

		const append = (manager: { query: (sql: string, params: unknown[]) => Promise<unknown> }, eventId: string, stampedAt: number) =>
			manager.query(`INSERT INTO "outbox" ("eventId", "eventName", "aggregateId", "createdAtMs", "payload") VALUES (?, 'task.updated', ?, ?, ?)`, [
				eventId,
				eventId,
				stampedAt,
				JSON.stringify({ entity: 'Task', entityId: eventId, action: 'updated' })
			]);

		it('still answers the row that committed after a later-stamped one was answered', async () => {
			const { service } = serviceOver(committedRows);
			const start = await service.catchUp({});

			// A begins (its row is stamped now), B begins a second later, and B commits first.
			const stampA = NOW + 1_000;
			const stampB = NOW + 2_000;
			const a = writerA.createQueryRunner();
			await a.startTransaction();
			await writerB.transaction((manager) => append(manager, 'b', stampB));

			// A catch-up between the two commits sees B only.
			clock.mockReturnValue(NOW + 2_500);
			const between = await service.catchUp({ after: start.cursor ?? 0, afterId: start.cursorId ?? undefined });
			expect(between.events.map((event) => event.eventId)).toEqual(['b']);
			// The position stays behind A's stamp: A has not committed yet and may still appear before B.
			expect(between.cursor).toBeLessThan(stampA);

			await append(a.manager, 'a', stampA);
			await a.commitTransaction();
			await a.release();

			// The next catch-up from the answered position answers A (and B again, which the client applies once).
			clock.mockReturnValue(NOW + 4_000);
			const after = await service.catchUp({ after: between.cursor ?? 0, afterId: between.cursorId ?? undefined });
			expect(after.events.map((event) => event.eventId)).toEqual(['a', 'b']);

			// A position at the last row answered — what the catch-up used to answer — would have lost A for good.
			const fromB = await service.catchUp({ after: stampB, afterId: 'b' });
			expect(fromB.events).toEqual([]);

			// Once both have settled the position passes them, and nothing is answered twice more.
			clock.mockReturnValue(stampB + REALTIME_CATCH_UP_SETTLE_MS + 1);
			const settledAnswer = await service.catchUp({ after: after.cursor ?? 0, afterId: after.cursorId ?? undefined });
			expect(settledAnswer.cursor).toBeGreaterThan(stampB);
			const quiet = await service.catchUp({ after: settledAnswer.cursor ?? 0, afterId: settledAnswer.cursorId ?? undefined });
			expect(quiet.events).toEqual([]);
		});
	});
});
