import { Injectable, Logger, Optional, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ID, IRealtimeCatchUp, IRealtimeCatchUpQuery, IRealtimeEventEnvelope } from '@gauzy/contracts';
import { EventOutbox, EventOutboxService, RequestContext, SubscriptionCatalogue } from '@gauzy/core';
import type { SubscriptionAudienceEvent } from '@gauzy/core';
import {
	REALTIME_CATCH_UP_DEFAULT,
	REALTIME_CATCH_UP_HORIZON_REUSE_MS,
	REALTIME_CATCH_UP_MAX,
	REALTIME_CATCH_UP_MAX_HOLD_MS,
	REALTIME_CATCH_UP_SETTLE_MS
} from './realtime.constants';
import { collaborationReplayNames, withoutRecipients } from './graphql/realtime-envelope';
import { RealtimeAudience } from './realtime-audience';
import { IRealtimeReplayPosition, RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';

/** The members of an outbox row the catch-up reads. */
export type CatchUpRow = Pick<EventOutbox, 'eventId' | 'eventName' | 'aggregateType' | 'aggregateId' | 'createdAt' | 'sequence' | 'payload'>;

/** How many rows are read for one page: the audience rule may drop some, so more than the page is read. */
export const CATCH_UP_READ_FACTOR = 4;

/**
 * The epoch milliseconds a row happened at: its append time (`createdAt`), which never moves — unlike
 * `availableAt`, which the dispatcher pushes for leases and retries.
 */
export function rowTime(row: Pick<CatchUpRow, 'createdAt'>): number {
	const at = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as unknown as string);
	const ms = at.getTime();
	return Number.isFinite(ms) ? ms : 0;
}

/**
 * Whether the caller may receive a row: an addressed row (a payload that names `recipientUserIds`) only when
 * the caller is one of them; anything else is organization-wide and admitted (the listing that produced the
 * rows already scoped them to the caller's tenant and organization).
 */
export function admitsRow(row: Pick<CatchUpRow, 'payload'>, userId: string | null): boolean {
	const recipients = (row.payload as Record<string, unknown> | null)?.['recipientUserIds'];
	if (recipients === undefined || recipients === null) {
		return true;
	}
	if (!Array.isArray(recipients) || !userId) {
		return false;
	}
	return recipients.map(String).includes(String(userId));
}

/** A row as the audience checks read it (see {@link RealtimeAudience}). */
export function audienceEventOfRow(
	row: Pick<CatchUpRow, 'eventName' | 'aggregateType' | 'aggregateId' | 'payload'>
): SubscriptionAudienceEvent {
	const payload = row.payload;
	const isObject = payload !== null && typeof payload === 'object' && !Array.isArray(payload);
	return {
		name: String(row.eventName),
		aggregateType: String(row.aggregateType ?? ''),
		aggregateId: String(row.aggregateId ?? ''),
		data: isObject ? (payload as Record<string, unknown>) : {}
	};
}

/**
 * The order a catch-up cursor walks: time, then event id — a total order, and the one the outbox read uses, so a
 * bounded read and a page cut a same-millisecond group at the same place.
 */
export function compareRows(a: Pick<CatchUpRow, 'createdAt' | 'eventId'>, b: Pick<CatchUpRow, 'createdAt' | 'eventId'>): number {
	return rowTime(a) - rowTime(b) || String(a.eventId).localeCompare(String(b.eventId));
}

/** Whether a row comes after the cursor (`after` + `afterId`); without `afterId` the cursor time is inclusive. */
export function afterCursor(row: Pick<CatchUpRow, 'createdAt' | 'eventId'>, after: number, afterId: string | null): boolean {
	const at = rowTime(row);
	if (at > after) return true;
	if (at < after) return false;
	return afterId ? String(row.eventId).localeCompare(afterId) > 0 : true;
}

/**
 * The settle horizon at a moment: the newest time a resume position may name. A row is stamped (`createdAt`) when its
 * transaction writes it, which on Postgres is the transaction's start, and becomes readable only when that transaction
 * commits; a row stamped before one already read can therefore still appear. Any row stamped before the horizon has
 * committed by now (or never will), so a cursor that never passes the horizon never walks past a row that is yet to
 * appear.
 */
export function settleHorizon(now: number = Date.now()): number {
	return now - REALTIME_CATCH_UP_SETTLE_MS;
}

/**
 * The settle horizon held behind the oldest transaction still open in the database (on Postgres).
 *
 * The settle window alone assumes no appending transaction stays open longer than it; one that waits on a row lock
 * can. On Postgres a row is stamped with its transaction's start (`createdAt` defaults to `now()`), so no row can
 * appear stamped before the oldest transaction open now: the horizon stays the settle window behind that
 * transaction's start as well. A transaction open longer than {@link REALTIME_CATCH_UP_MAX_HOLD_MS} (a forgotten
 * session) holds it back no further — the cursor must still move — so an event such a transaction appends can fall
 * behind a cursor already answered, and a client that missed it live does not get it from the catch-up (plan §15.6,
 * the remaining gap). Elsewhere the stamp is the statement's time, taken just before the commit (MySQL), or there is
 * one writer at a time (SQLite), and the settle window covers it. The transactions read are the ones
 * `pg_stat_activity` shows the platform's role: its own sessions, whatever process opened them.
 *
 * One read serves the process's catch-ups: concurrent callers share the read in flight, and a result serves for
 * {@link REALTIME_CATCH_UP_HORIZON_REUSE_MS} after it. Both are safe: a horizon taken at an earlier moment is never later
 * than one taken now (a transaction open now that began before that moment was open then too), so a reused horizon only
 * holds the cursor further back. A read that fails falls back to the settle window and is logged at most once a minute.
 */
@Injectable()
export class RealtimeSettleHorizon {
	private readonly logger = new Logger('RealtimeSettleHorizon');
	private recent: { at: number; horizon: number } | null = null;
	private pending: Promise<{ at: number; horizon: number }> | null = null;
	private warnedAt = Number.NEGATIVE_INFINITY;

	constructor(private readonly dataSource: DataSource) {}

	/** The newest time a resume position may name now, in epoch ms. */
	async horizon(now: number = Date.now()): Promise<number> {
		const base = settleHorizon(now);
		if (String(this.dataSource.options?.type) !== 'postgres') return base;
		const recent = this.recent;
		if (recent && recent.at <= now && now - recent.at < REALTIME_CATCH_UP_HORIZON_REUSE_MS) {
			return Math.min(recent.horizon, base);
		}
		this.pending ??= this.read(now).finally(() => {
			this.pending = null;
		});
		return Math.min((await this.pending).horizon, base);
	}

	/** Reads the oldest open transaction and turns it into a horizon taken at `now`. */
	private async read(now: number): Promise<{ at: number; horizon: number }> {
		const base = settleHorizon(now);
		let horizon = base;
		try {
			const [row] = await this.dataSource.query(
				`SELECT EXTRACT(EPOCH FROM (clock_timestamp() - MIN("xact_start"))) * 1000 AS "age" FROM "pg_stat_activity" WHERE "datname" = current_database() AND "xact_start" IS NOT NULL AND "pid" <> pg_backend_pid()`
			);
			const age = Number(row?.age);
			if (Number.isFinite(age) && age > 0) horizon = base - Math.min(age, REALTIME_CATCH_UP_MAX_HOLD_MS);
		} catch (error) {
			if (now - this.warnedAt >= 60_000) {
				this.warnedAt = now;
				this.logger.warn(`The open transactions were not read; the settle window alone holds the cursor: ${(error as Error)?.message}`);
			}
		}
		// Whole milliseconds, down: the cursor goes back to the client, whose `after` is an integer.
		this.recent = { at: now, horizon: Math.floor(horizon) };
		return this.recent;
	}
}

/**
 * Selects, orders and bounds the rows a catch-up answers, and the position to resume from.
 *
 * **The position never passes the settle horizon** ({@link settleHorizon}). The outbox's own `sequence` cannot order a
 * catch-up: it is numbered per partition (one aggregate), inside the writing transaction (the highest so far plus one),
 * so it says nothing about the order rows of different aggregates become readable. The time order (`createdAt`, then
 * `eventId`) is total but not commit-ordered: a transaction that stamped its row first can commit after a later-stamped
 * row was read. So the answered cursor stops at the horizon, and the rows read past it are still answered (a client is
 * not kept waiting for what it can apply now) — they are answered again by the next catch-up from that cursor, and a
 * client applies an event once by its `eventId`. A cursor a client sends from ahead of the horizon (one it took from a
 * streamed event) is kept: the catch-up never moves a cursor back.
 *
 * @param rows The caller's retained collaboration rows since the cursor time, any order.
 * @param userId The caller, for addressed rows.
 * @param query The client's cursor and limit.
 * @param state Whether the read may have left rows behind (`truncated`), whether the cursor precedes the retention
 * watermark (`resync`), and the settle horizon in epoch ms (`horizon`).
 * @param refused The event ids the audience checks refused this caller ({@link RealtimeAudience}): skipped like a
 * row addressed to someone else.
 * @returns The answer.
 */
export function selectCatchUp(
	rows: readonly CatchUpRow[],
	userId: string | null,
	query: IRealtimeCatchUpQuery,
	state: { truncated: boolean; resync: boolean; horizon: number },
	refused: ReadonlySet<string> = new Set<string>()
): IRealtimeCatchUp {
	const limit = Math.min(Math.max(Math.trunc(query.limit ?? REALTIME_CATCH_UP_DEFAULT), 1), REALTIME_CATCH_UP_MAX);
	const after = typeof query.after === 'number' && Number.isFinite(query.after) ? query.after : null;
	const afterId = typeof query.afterId === 'string' && query.afterId ? query.afterId : null;
	const horizon = state.horizon;

	// A client without a cursor has nothing to catch up on: it starts from the horizon (not "now", which a row stamped
	// before it but not yet committed would fall behind) and reads its data through the APIs.
	if (after === null) {
		return { events: [], cursor: horizon, cursorId: null, hasMore: false, resync: false };
	}

	// Every row after the cursor the read examined, in cursor order; then the ones this caller may receive.
	const examined = rows.filter((row) => afterCursor(row, after, afterId)).sort(compareRows);
	const visible = examined.filter((row) => admitsRow(row, userId) && !refused.has(String(row.eventId)));
	const page = visible.slice(0, limit);
	const full = page.length === limit;
	// How far this answer covers the scope: up to the last answered row when the page is full, else up to the last row
	// examined — visible to the caller or not, so a window of rows addressed to others never stalls the walk. `cut`
	// says whether rows may follow that this answer did not cover (left off a full page, or beyond a bounded read).
	const reach = full ? page[page.length - 1] : examined[examined.length - 1];
	const cut = full ? visible.length > limit || state.truncated : state.truncated;

	let cursor = after;
	let cursorId = afterId;
	let hasMore = false;
	if (cut && reach && rowTime(reach) < horizon) {
		// The answer stops before the horizon: continue after its last row, and say more follows.
		cursor = rowTime(reach);
		cursorId = String(reach.eventId);
		hasMore = true;
	} else if (cut && !reach) {
		// A bounded read that held nothing after the cursor (a same-millisecond group larger than the read): unchanged.
		hasMore = true;
	} else if (horizon > after) {
		// Every row stamped before the horizon was examined (none was cut off before it): the position is the horizon
		// itself, as a time without an id — the rows stamped at it or later are answered again next time. Rows past the
		// horizon are left for later even when more exist (`hasMore` false): reading them again from the horizon would
		// answer the same rows and never move.
		cursor = horizon;
		cursorId = null;
	}

	const events: IRealtimeEventEnvelope[] = page.map((row) => ({
		eventId: row.eventId,
		eventName: row.eventName,
		occurredAt: row.createdAt as Date,
		aggregate: { type: row.aggregateType, id: row.aggregateId },
		sequence: typeof row.sequence === 'number' ? row.sequence : null,
		data: withoutRecipients(row.payload ?? {})
	}));

	return { events, cursor, cursorId, hasMore, resync: state.resync };
}

/**
 * Whether a retention watermark lies after a cursor: a row the retention removed (the watermark is the newest one, in
 * cursor order) may be one the client never applied, so it must refetch rather than replay.
 *
 * @param watermark The newest position removed from the caller's scope, or null when nothing was.
 * @param after The cursor time.
 * @param afterId The cursor's event id; without one, the cursor time is inclusive (a row at that time is unapplied).
 */
export function precedesWatermark(watermark: IRealtimeReplayPosition | null, after: number, afterId: string | null): boolean {
	if (!watermark) return false;
	return afterCursor({ createdAt: new Date(watermark.at), eventId: watermark.eventId as ID }, after, afterId);
}

/**
 * Catch-up after a reconnect: the collaboration events of the caller's scope after a cursor, from the outbox.
 *
 * The outbox is the replay store. The rows are read through the outbox service's bounded, caller-scoped read
 * (tenant, organization or tenant-wide; the collaboration event names; `createdAt` from the cursor time; ordered
 * by `createdAt` then `eventId`, the cursor's own order), then selected in code: the recipient rule, the audience
 * rule (the caller's read access to the record a row names, and current chat membership — {@link RealtimeAudience},
 * one check per batch), the exact cursor (`after` + `afterId`) and the page. The answered cursor is the position
 * walked to — the last row examined when the answer stops early, which may be a row addressed to someone else or one
 * the audience rule refused — and never later than the settle horizon (see {@link selectCatchUp}), so a row that
 * commits after a later-stamped one was answered is still ahead of the cursor. `resync` is answered when the cursor
 * precedes the retention watermark of the caller's scope (the newest position a retention removed,
 * {@link RealtimeReplayWatermarkService}): the client then refetches through the read APIs rather than trusting a
 * stream that lost rows. Nothing else answers `resync` — not an empty scope, nor a cursor older than the scope's
 * first row: nothing was removed there.
 */
@Injectable()
export class RealtimeCatchUpService {
	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly audience: RealtimeAudience,
		private readonly watermarks: RealtimeReplayWatermarkService,
		@Optional() private readonly horizons?: RealtimeSettleHorizon
	) {}

	async catchUp(query: IRealtimeCatchUpQuery): Promise<IRealtimeCatchUp> {
		const outbox = this.find(EventOutboxService);
		if (!outbox) {
			return { events: [], cursor: null, cursorId: null, hasMore: false, resync: false };
		}
		// Taken before anything is read: a row stamped before it that commits during this call is still ahead of the
		// answered cursor.
		const horizon = this.horizons ? await this.horizons.horizon() : settleHorizon();
		const after = typeof query.after === 'number' && Number.isFinite(query.after) ? query.after : null;
		const userId = RequestContext.currentUserId();
		if (after === null) {
			return selectCatchUp([], userId ? String(userId) : null, query, { truncated: false, resync: false, horizon });
		}
		const limit = Math.min(Math.max(Math.trunc(query.limit ?? REALTIME_CATCH_UP_DEFAULT), 1), REALTIME_CATCH_UP_MAX);
		const read = Math.min(limit * CATCH_UP_READ_FACTOR, 2000);
		const afterId = typeof query.afterId === 'string' && query.afterId ? query.afterId : null;

		// The durable names of the collaboration families, the chat and inbox ones included when those plugins declared them.
		const eventNames = collaborationReplayNames(this.find(SubscriptionCatalogue)?.names() ?? []);
		const rows = await outbox.listOutboxRowsSince({ eventNames, since: new Date(after), limit: read });

		// The retention watermark of the caller's scope, read after the rows: a retention that committed between the two
		// reads (rows read already pruned) moved the watermark, so the answer says `resync`. A read that fails is an
		// error the client sees, never an empty answer it would trust.
		const tenantId = RequestContext.currentTenantId();
		const watermark = tenantId
			? await this.watermarks.forScope(String(tenantId), RequestContext.currentOrganizationId() ?? null)
			: null;
		const resync = precedesWatermark(watermark, after, afterId);
		const caller = userId ? String(userId) : null;
		const refused = await this.refusedRows(rows, caller, after, afterId);
		return selectCatchUp(rows, caller, query, { truncated: rows.length >= read, resync, horizon }, refused);
	}

	/**
	 * The rows after the cursor, addressed to the caller or to everyone, that the audience checks refuse the caller,
	 * by event id. The rows are decided together, one check per batch. A check that cannot answer fails the catch-up
	 * (the client asks again) rather than letting the cursor walk past rows nobody decided.
	 */
	private async refusedRows(
		rows: readonly CatchUpRow[],
		userId: string | null,
		after: number,
		afterId: string | null
	): Promise<Set<string>> {
		const candidates = rows.filter((row) => afterCursor(row, after, afterId) && admitsRow(row, userId));
		const refused = new Set<string>();
		if (!candidates.length) {
			return refused;
		}
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			// The outbox read is scoped by the caller's tenant; without one nothing above was read for anybody.
			return new Set(candidates.map((row) => String(row.eventId)));
		}
		const verdicts = await this.audience.admitted(candidates.map(audienceEventOfRow), {
			tenantId: String(tenantId),
			organizationId: RequestContext.currentOrganizationId() ?? null,
			userId
		});
		candidates.forEach((row, index) => {
			if (!verdicts[index]) refused.add(String(row.eventId));
		});
		return refused;
	}

	private find<T>(token: Type<T>): T | undefined {
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
