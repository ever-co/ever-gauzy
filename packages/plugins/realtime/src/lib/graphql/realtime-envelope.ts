import {
	IRealtimeEventEnvelope,
	isCollaborationEventName,
	JsonData,
	REALTIME_SIGNAL_EVENTS,
	REALTIME_STREAMED_EVENTS,
	REALTIME_SUBSCRIBABLE_EVENTS
} from '@gauzy/contracts';
import { matchesEventSelection } from '@gauzy/core';
import type { SubscriptionAudienceEvent, SubscriptionEnvelope } from '@gauzy/core';

/** The largest value the schema's `Int` carries. A sequence past it is served as null, never truncated. */
const GRAPHQL_INT_MAX = 2 ** 31 - 1;

/**
 * The names the collaboration channel offers: its own, plus the names of the collaboration families that other
 * plugins (chat, inbox) declared with the subscription catalogue when they loaded. Whatever else the installation
 * streams (`order.*`) is not offered.
 *
 * @param declared Every name the subscription catalogue holds.
 * @returns The offered names, deduplicated and ordered.
 */
export function collaborationEventNames(declared: readonly string[] = []): string[] {
	const names = new Set<string>(REALTIME_SUBSCRIBABLE_EVENTS);
	for (const name of declared) {
		if (isCollaborationEventName(name)) names.add(name);
	}
	return Array.from(names).sort();
}

/** The offered names the catch-up replays: the durable ones (a signal is never stored). */
export function collaborationReplayNames(declared: readonly string[] = []): string[] {
	const signals = new Set<string>(REALTIME_SIGNAL_EVENTS);
	const names = new Set<string>(REALTIME_STREAMED_EVENTS);
	for (const name of collaborationEventNames(declared)) {
		if (!signals.has(name)) names.add(name);
	}
	return Array.from(names).sort();
}

/**
 * Turns a client's selection into the collaboration events it covers.
 *
 * Only the offered names are matched (see {@link collaborationEventNames}): a selection that reaches outside
 * them (`order.*`) or matches nothing is refused rather than accepted and left silent.
 *
 * @param selections Exact names or one-segment prefix patterns.
 * @param offered The names offered; the channel's own when not stated.
 * @returns The matching names, deduplicated and ordered; empty when nothing matches.
 */
export function resolveRealtimeSelection(selections: readonly string[], offered: readonly string[] = REALTIME_SUBSCRIBABLE_EVENTS): string[] {
	const matched = new Set<string>();
	for (const selection of selections ?? []) {
		if (typeof selection !== 'string' || !selection) {
			continue;
		}
		for (const name of offered) {
			if (matchesEventSelection(selection, name)) {
				matched.add(name);
			}
		}
	}
	return Array.from(matched).sort();
}

/**
 * Reads one hub envelope as the schema's `EventEnvelope`, or nothing when it cannot fill the non-null members.
 *
 * The hub (or the topic stream) has already decided on the tenant, the organization and the recipients; what
 * is withheld here is the recipient list itself — a recipient is not handed the other recipients — and any
 * envelope that lacks an identity or an aggregate.
 *
 * @param payload The hub envelope.
 * @returns The envelope to deliver, or undefined.
 */
export function toRealtimeEnvelope(payload: SubscriptionEnvelope | undefined): IRealtimeEventEnvelope | undefined {
	if (!payload || typeof payload.name !== 'string' || !payload.eventId) {
		return undefined;
	}
	const aggregate = payload.aggregate;
	if (!aggregate?.type || !aggregate?.id) {
		return undefined;
	}
	const sequence = payload.sequence;

	return {
		eventId: String(payload.eventId),
		eventName: payload.name,
		occurredAt: payload.occurredAt ?? new Date(),
		aggregate: { type: String(aggregate.type), id: String(aggregate.id) },
		sequence:
			typeof sequence === 'number' && Number.isInteger(sequence) && Math.abs(sequence) <= GRAPHQL_INT_MAX
				? sequence
				: null,
		data: withoutRecipients(payload.data ?? {}) as JsonData
	};
}

/** A hub envelope as the audience checks read it (see `RealtimeAudience`). */
export function audienceEventOfEnvelope(payload: SubscriptionEnvelope): SubscriptionAudienceEvent {
	const data = payload?.data;
	return {
		name: String(payload?.name ?? ''),
		aggregateType: String(payload?.aggregate?.type ?? ''),
		aggregateId: String(payload?.aggregate?.id ?? ''),
		data: data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
	};
}

/** The payload a subscriber reads: the data without the recipient list that addressed it. */
export function withoutRecipients<T>(data: T): T {
	if (data === null || typeof data !== 'object' || Array.isArray(data)) {
		return data;
	}
	const { recipientUserIds: _recipients, ...rest } = data as Record<string, unknown>;
	return rest as T;
}
