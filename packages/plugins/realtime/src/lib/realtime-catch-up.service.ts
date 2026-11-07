import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IRealtimeCatchUp, IRealtimeCatchUpQuery, IRealtimeEventEnvelope, REALTIME_STREAMED_EVENTS } from '@gauzy/contracts';
import { EventOutbox, EventOutboxService, RequestContext } from '@gauzy/core';
import { REALTIME_CATCH_UP_DEFAULT, REALTIME_CATCH_UP_MAX } from './realtime.constants';
import { withoutRecipients } from './graphql/realtime-envelope';

/** The members of an outbox row the catch-up reads. */
export type CatchUpRow = Pick<EventOutbox, 'eventId' | 'eventName' | 'aggregateType' | 'aggregateId' | 'availableAt' | 'sequence' | 'payload'>;

/** The epoch milliseconds a row happened at (its append time). */
export function rowTime(row: Pick<CatchUpRow, 'availableAt'>): number {
	const at = row.availableAt instanceof Date ? row.availableAt : new Date(row.availableAt as unknown as string);
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
 * Selects, orders and bounds the rows a catch-up answers.
 *
 * @param rows The caller's retained collaboration rows, any order.
 * @param userId The caller, for addressed rows.
 * @param query The client's cursor and limit.
 * @returns The answer.
 */
export function selectCatchUp(rows: readonly CatchUpRow[], userId: string | null, query: IRealtimeCatchUpQuery): IRealtimeCatchUp {
	const limit = Math.min(Math.max(Math.trunc(query.limit ?? REALTIME_CATCH_UP_DEFAULT), 1), REALTIME_CATCH_UP_MAX);
	const after = typeof query.after === 'number' && Number.isFinite(query.after) ? query.after : null;

	const visible = rows.filter((row) => admitsRow(row, userId));
	const oldest = visible.reduce<number | null>((min, row) => {
		const at = rowTime(row);
		return min === null || at < min ? at : min;
	}, null);

	// A cursor older than everything retained means events may have been purged in between: the client refetches.
	const resync = after !== null && oldest !== null && after < oldest;

	const ordered = visible
		.filter((row) => after === null || rowTime(row) >= after)
		.sort((a, b) => rowTime(a) - rowTime(b) || String(a.eventId).localeCompare(String(b.eventId)));

	// Without a cursor the newest events are the useful ones; with one, the oldest since it.
	const page = after === null ? ordered.slice(-limit) : ordered.slice(0, limit);

	const events: IRealtimeEventEnvelope[] = page.map((row) => ({
		eventId: row.eventId,
		eventName: row.eventName,
		occurredAt: row.availableAt,
		aggregate: { type: row.aggregateType, id: row.aggregateId },
		sequence: typeof row.sequence === 'number' ? row.sequence : null,
		data: withoutRecipients(row.payload ?? {})
	}));

	const cursor = page.length ? rowTime(page[page.length - 1]) : after;

	return { events, cursor: cursor ?? null, resync };
}

/**
 * Catch-up after a reconnect: the collaboration events of the caller's scope since a time, from the outbox.
 *
 * The outbox is the replay store. Rows are listed through the outbox service's own caller-scoped read
 * (tenant, organization or tenant-wide), one listing per collaboration event name, then selected in code:
 * the recipient rule, the cursor and the bound. The read is bounded by what the outbox retains.
 */
@Injectable()
export class RealtimeCatchUpService {
	constructor(private readonly moduleRef: ModuleRef) {}

	async catchUp(query: IRealtimeCatchUpQuery): Promise<IRealtimeCatchUp> {
		const outbox = this.find(EventOutboxService);
		if (!outbox) {
			return { events: [], cursor: null, resync: false };
		}
		const listings = await Promise.all(
			REALTIME_STREAMED_EVENTS.map((eventName) => outbox.listOutboxRows({ eventName }).catch(() => [] as EventOutbox[]))
		);
		const userId = RequestContext.currentUserId();
		return selectCatchUp(listings.flat(), userId ? String(userId) : null, query);
	}

	private find<T>(token: Type<T>): T | undefined {
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
