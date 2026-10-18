import { In, Repository } from 'typeorm';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import { EverWorksInboundEvent, EverWorksInboundStatus } from '../sync/entities/ever-works-sync.entities';

/** How many deferred inbox events the People tab reads at most (newest first). */
export const DEFERRED_INBOX_SCAN = 2000;
/** How many of a member's waiting items the People tab lists (the count covers all of them). */
export const DEFERRED_INBOX_SAMPLE = 5;

/**
 * One Ever Works member's inbox items that wait for a pairing (plan 04 §4): an item whose recipient is not paired
 * with a Gauzy person is not delivered; its event waits as `deferred` and is listed on the People tab.
 */
export interface EverWorksDeferredInboxRow {
	ewUserId: string;
	/** Distinct Ever Works items waiting for this member. */
	count: number;
	/**
	 * The newest few, newest first. `title` is always empty: an inbox item is private to its recipient, and the People
	 * tab is read by integration admins, so only its kind and time are listed (review F103).
	 */
	items: Array<{ ewItemId: string; title: string; kind: string | null; occurredAt: string | null }>;
}

type DeferredEvent = Pick<EverWorksInboundEvent, 'id' | 'aggregateId' | 'payload'>;

/** The recipient and kind an inbox event carries (`null` when its payload cannot be read); never its title. */
function inboxOf(event: DeferredEvent): { recipient: string; kind: string | null; occurredAt: string | null } | null {
	try {
		const envelope = JSON.parse(event.payload) as EverWorksEventEnvelope;
		const data = (envelope.data ?? {}) as { recipientUserId?: unknown; kind?: unknown };
		if (typeof data.recipientUserId !== 'string' || !data.recipientUserId) return null;
		return {
			recipient: data.recipientUserId,
			kind: typeof data.kind === 'string' ? data.kind : null,
			occurredAt: typeof envelope.occurredAt === 'string' ? envelope.occurredAt : null
		};
	} catch {
		return null;
	}
}

/**
 * Groups deferred inbox events (newest first) by their recipient, for the recipients not paired: one entry per
 * Ever Works item (its newest event), the members with the most waiting items first. An event deferred for
 * another reason (its recipient is paired) is left out.
 */
export function deferredInboxOf(
	events: readonly DeferredEvent[],
	pairedUsers: ReadonlySet<string>
): EverWorksDeferredInboxRow[] {
	const byUser = new Map<string, EverWorksDeferredInboxRow>();
	const seen = new Set<string>();
	for (const event of events) {
		const item = inboxOf(event);
		if (!item || pairedUsers.has(item.recipient) || seen.has(event.aggregateId)) continue;
		seen.add(event.aggregateId);
		const row = byUser.get(item.recipient) ?? { ewUserId: item.recipient, count: 0, items: [] };
		row.count++;
		if (row.items.length < DEFERRED_INBOX_SAMPLE) {
			row.items.push({
				ewItemId: event.aggregateId,
				// The title is the recipient's alone (review F103).
				title: '',
				kind: item.kind,
				occurredAt: item.occurredAt
			});
		}
		byUser.set(item.recipient, row);
	}
	return [...byUser.values()].sort((a, b) => b.count - a.count || a.ewUserId.localeCompare(b.ewUserId));
}

/**
 * Makes the deferred inbox events of newly paired members due now (they waited for the pairing; the hourly
 * retry would deliver them up to an hour later). Only rows still `deferred` are touched. Returns how many.
 */
export async function requeueDeferredInbox(
	repository: Pick<Repository<EverWorksInboundEvent>, 'update'>,
	events: readonly DeferredEvent[],
	pairedNow: ReadonlySet<string>,
	now: Date = new Date()
): Promise<number> {
	const ids = events
		.filter((event) => {
			const item = inboxOf(event);
			return !!item && pairedNow.has(item.recipient);
		})
		.map((event) => event.id);
	if (!ids.length) return 0;
	const result = await repository.update(
		{ id: In(ids), status: EverWorksInboundStatus.DEFERRED } as never,
		{ availableAt: now } as never
	);
	return result.affected ?? ids.length;
}
