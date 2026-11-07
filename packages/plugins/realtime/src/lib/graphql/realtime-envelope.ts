import { IRealtimeEventEnvelope, JsonData, REALTIME_SUBSCRIBABLE_EVENTS } from '@gauzy/contracts';
import { matchesEventSelection } from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';

/** The largest value the schema's `Int` carries. A sequence past it is served as null, never truncated. */
const GRAPHQL_INT_MAX = 2 ** 31 - 1;

/**
 * Turns a client's selection into the collaboration events it covers.
 *
 * Only the plugin's own catalogue is offered here, whatever else the installation streams: a selection that
 * reaches outside it (`order.*`) or matches nothing is refused rather than accepted and left silent.
 *
 * @param selections Exact names or one-segment prefix patterns.
 * @returns The matching names, deduplicated and ordered; empty when nothing matches.
 */
export function resolveRealtimeSelection(selections: readonly string[]): string[] {
	const matched = new Set<string>();
	for (const selection of selections ?? []) {
		if (typeof selection !== 'string' || !selection) {
			continue;
		}
		for (const name of REALTIME_SUBSCRIBABLE_EVENTS) {
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

/** The payload a subscriber reads: the data without the recipient list that addressed it. */
export function withoutRecipients<T>(data: T): T {
	if (data === null || typeof data !== 'object' || Array.isArray(data)) {
		return data;
	}
	const { recipientUserIds: _recipients, ...rest } = data as Record<string, unknown>;
	return rest as T;
}
