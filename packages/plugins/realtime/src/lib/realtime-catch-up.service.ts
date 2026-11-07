import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IRealtimeCatchUp, IRealtimeCatchUpQuery, IRealtimeEventEnvelope } from '@gauzy/contracts';
import { EventOutbox, EventOutboxService, RequestContext, SubscriptionCatalogue } from '@gauzy/core';
import { REALTIME_CATCH_UP_DEFAULT, REALTIME_CATCH_UP_MAX } from './realtime.constants';
import { collaborationReplayNames, withoutRecipients } from './graphql/realtime-envelope';

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
 * Selects, orders and bounds the rows a catch-up answers.
 *
 * @param rows The caller's retained collaboration rows since the cursor time, any order.
 * @param userId The caller, for addressed rows.
 * @param query The client's cursor and limit.
 * @param state Whether the read may have left rows behind (`truncated`) and whether the cursor predates the
 * retention watermark (`resync`).
 * @returns The answer.
 */
export function selectCatchUp(
	rows: readonly CatchUpRow[],
	userId: string | null,
	query: IRealtimeCatchUpQuery,
	state: { truncated: boolean; resync: boolean }
): IRealtimeCatchUp {
	const limit = Math.min(Math.max(Math.trunc(query.limit ?? REALTIME_CATCH_UP_DEFAULT), 1), REALTIME_CATCH_UP_MAX);
	const after = typeof query.after === 'number' && Number.isFinite(query.after) ? query.after : null;
	const afterId = typeof query.afterId === 'string' && query.afterId ? query.afterId : null;

	// A client without a cursor has nothing to catch up on: it starts from now and reads its data through the APIs.
	if (after === null) {
		return { events: [], cursor: Date.now(), cursorId: null, hasMore: false, resync: false };
	}

	// Every row after the cursor the read examined, in cursor order; then the ones this caller may receive.
	const examined = rows.filter((row) => afterCursor(row, after, afterId)).sort(compareRows);
	const visible = examined.filter((row) => admitsRow(row, userId));
	const page = visible.slice(0, limit);
	const full = page.length === limit;
	// The position to continue from: the last answered row when the page is full (visible rows may follow it);
	// otherwise the last row examined, visible to the caller or not — every visible row up to it was answered, so
	// a window of rows addressed to others never stalls the walk.
	const position = full ? page[page.length - 1] : examined[examined.length - 1];

	const events: IRealtimeEventEnvelope[] = page.map((row) => ({
		eventId: row.eventId,
		eventName: row.eventName,
		occurredAt: row.createdAt as Date,
		aggregate: { type: row.aggregateType, id: row.aggregateId },
		sequence: typeof row.sequence === 'number' ? row.sequence : null,
		data: withoutRecipients(row.payload ?? {})
	}));

	return {
		events,
		cursor: position ? rowTime(position) : after,
		cursorId: position ? String(position.eventId) : afterId,
		// More may follow when visible rows were left off a full page, or when the read itself was cut.
		hasMore: full ? visible.length > limit || state.truncated : state.truncated,
		resync: state.resync
	};
}

/**
 * Catch-up after a reconnect: the collaboration events of the caller's scope after a cursor, from the outbox.
 *
 * The outbox is the replay store. The rows are read through the outbox service's bounded, caller-scoped read
 * (tenant, organization or tenant-wide; the collaboration event names; `createdAt` from the cursor time; ordered
 * by `createdAt` then `eventId`, the cursor's own order), then selected in code: the recipient rule, the exact
 * cursor (`after` + `afterId`) and the page. The answered cursor is the position walked to — the last row
 * examined when the page is not full, which may be a row addressed to someone else. `resync` is answered
 * when the cursor predates the oldest row the caller's scope still retains — the retention watermark this
 * installation can state — or when nothing is retained at all: the client then refetches through the read APIs
 * rather than trusting a stream that may have lost rows.
 */
@Injectable()
export class RealtimeCatchUpService {
	constructor(private readonly moduleRef: ModuleRef) {}

	async catchUp(query: IRealtimeCatchUpQuery): Promise<IRealtimeCatchUp> {
		const outbox = this.find(EventOutboxService);
		if (!outbox) {
			return { events: [], cursor: null, cursorId: null, hasMore: false, resync: false };
		}
		const after = typeof query.after === 'number' && Number.isFinite(query.after) ? query.after : null;
		const userId = RequestContext.currentUserId();
		if (after === null) {
			return selectCatchUp([], userId ? String(userId) : null, query, { truncated: false, resync: false });
		}
		const limit = Math.min(Math.max(Math.trunc(query.limit ?? REALTIME_CATCH_UP_DEFAULT), 1), REALTIME_CATCH_UP_MAX);
		const read = Math.min(limit * CATCH_UP_READ_FACTOR, 2000);

		// The watermark: the oldest row of any name the caller's scope retains. A read that fails is an error the
		// client sees, never an empty answer it would trust.
		const [oldest] = await outbox.listOutboxRowsSince({ limit: 1 });
		const resync = !oldest || after < rowTime(oldest);

		// The durable names of the collaboration families, the chat and inbox ones included when those plugins declared them.
		const eventNames = collaborationReplayNames(this.find(SubscriptionCatalogue)?.names() ?? []);
		const rows = await outbox.listOutboxRowsSince({ eventNames, since: new Date(after), limit: read });
		return selectCatchUp(rows, userId ? String(userId) : null, query, { truncated: rows.length >= read, resync });
	}

	private find<T>(token: Type<T>): T | undefined {
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
