import { DataSource, In, IsNull } from 'typeorm';
import { CHAT_EVENT_NAMES, ID } from '@gauzy/contracts';
import type { SubscriptionAudienceCheck, SubscriptionAudienceEvent, SubscriptionAudienceSubscriber } from '@gauzy/core';
import { ChatMember } from '../entities/chat-member.entity';

/** The most ids one membership query names (one query for a whole catch-up page, far from any parameter limit). */
export const CHAT_AUDIENCE_QUERY_CHUNK = 500;

/** The conversation a chat fact belongs to: every chat fact names it (`conversationId`). */
export function conversationOfFact(event: Pick<SubscriptionAudienceEvent, 'data'>): string | null {
	const id = event.data?.['conversationId'];
	return typeof id === 'string' && id ? id : null;
}

/** The notice that tells a removed member they were removed: theirs after the removal too, or they never learn it. */
export function isRemovalNotice(event: Pick<SubscriptionAudienceEvent, 'name' | 'data'>): boolean {
	return event.name === CHAT_EVENT_NAMES.CONVERSATION_CHANGED && event.data?.['change'] === 'removed';
}

/** One subscriber's question, waiting for the turn's query. */
interface PendingLookup {
	tenantId: string;
	userId: string;
	conversationIds: string[];
	resolve: (current: Set<string>) => void;
	reject: (error: unknown) => void;
}

/**
 * The chat plugin's audience check for its streamed facts: a fact is delivered — live or replayed by the catch-up —
 * only to a user who is a member of its conversation **now** (an active `chat_member` row: `leftAt` unset), whatever
 * the recipients stored when it was written. A member who left or was removed no longer replays the conversation's
 * ids; the notice of their own removal still reaches them.
 *
 * Cheap by construction: the check answers a whole batch (a catch-up page) with one query, and the lookups of one
 * turn of the event loop — every connection a live fact fans out to — are answered together, one query per tenant.
 * The lookup names the subscriber explicitly (tenant, user), so batching across connections reads nobody's context.
 */
export class ChatMembershipAudience {
	private pending: PendingLookup[] = [];

	constructor(private readonly dataSource: DataSource) {}

	/** The check registered with the subscription catalogue for the chat names. */
	readonly check: SubscriptionAudienceCheck = async (events, subscriber) => {
		if (!subscriber?.userId || !subscriber.tenantId) {
			return events.map(() => false);
		}
		const conversationIds = [...new Set(events.map(conversationOfFact).filter((id): id is string => !!id))];
		const current = conversationIds.length
			? await this.currentMemberships(subscriber, conversationIds)
			: new Set<string>();
		return events.map((event) => {
			const conversationId = conversationOfFact(event);
			return !!conversationId && (current.has(conversationId) || isRemovalNotice(event));
		});
	};

	/** The conversations among the given ones the subscriber is an active member of. */
	private currentMemberships(
		subscriber: SubscriptionAudienceSubscriber,
		conversationIds: string[]
	): Promise<Set<string>> {
		return new Promise<Set<string>>((resolve, reject) => {
			this.pending.push({
				tenantId: String(subscriber.tenantId),
				userId: String(subscriber.userId),
				conversationIds,
				resolve,
				reject
			});
			if (this.pending.length === 1) {
				setImmediate(() => void this.flush());
			}
		});
	}

	/** Answers every lookup of the turn: one query per tenant (per chunk of ids). */
	private async flush(): Promise<void> {
		const lookups = this.pending.splice(0);
		const byTenant = new Map<string, PendingLookup[]>();
		for (const lookup of lookups) {
			byTenant.set(lookup.tenantId, [...(byTenant.get(lookup.tenantId) ?? []), lookup]);
		}
		await Promise.all(
			Array.from(byTenant, async ([tenantId, group]) => {
				try {
					const memberships = await this.activeMemberships(
						tenantId,
						[...new Set(group.map((lookup) => lookup.userId))],
						[...new Set(group.flatMap((lookup) => lookup.conversationIds))]
					);
					for (const lookup of group) {
						lookup.resolve(
							new Set(lookup.conversationIds.filter((id) => memberships.has(`${lookup.userId}|${id}`)))
						);
					}
				} catch (error) {
					for (const lookup of group) lookup.reject(error);
				}
			})
		);
	}

	/** The active memberships of the given users in the given conversations, keyed `<userId>|<conversationId>`. */
	private async activeMemberships(
		tenantId: string,
		userIds: string[],
		conversationIds: string[]
	): Promise<Set<string>> {
		const memberships = new Set<string>();
		const repository = this.dataSource.getRepository(ChatMember);
		for (let users = 0; users < userIds.length; users += CHAT_AUDIENCE_QUERY_CHUNK) {
			for (
				let conversations = 0;
				conversations < conversationIds.length;
				conversations += CHAT_AUDIENCE_QUERY_CHUNK
			) {
				const rows = await repository.find({
					select: { userId: true, conversationId: true },
					where: {
						tenantId: tenantId as ID,
						userId: In(userIds.slice(users, users + CHAT_AUDIENCE_QUERY_CHUNK) as ID[]),
						conversationId: In(
							conversationIds.slice(conversations, conversations + CHAT_AUDIENCE_QUERY_CHUNK) as ID[]
						),
						leftAt: IsNull()
					}
				});
				for (const row of rows) memberships.add(`${row.userId}|${row.conversationId}`);
			}
		}
		return memberships;
	}
}
