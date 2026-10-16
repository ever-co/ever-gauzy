import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksApiError } from '../../client/ever-works-client';
import { EverWorksConnection, EverWorksConnectionStatus } from '../../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../../connection/ever-works-connection.service';
import type { EverWorksEventEnvelope } from '../../client/ever-works-client.types';
import { compareSeq, EverWorksEnvelopeError, parseEverWorksEnvelope } from './ever-works-envelope';
import { EverWorksInboundStore } from './ever-works-inbound.store';

/** Poll every minute when no webhook arrived for 5 minutes, otherwise every 10 minutes (plan 03 §C.4). */
export const FEED_POLL_FAST_MS = 60_000;
export const FEED_POLL_SLOW_MS = 10 * 60_000;
export const WEBHOOK_QUIET_MS = 5 * 60_000;
/** Pages read per poll (500 events each); the rest is read on the next tick. */
export const FEED_MAX_PAGES = 10;

/** The outcome of one poll. */
export interface EverWorksFeedPollResult {
	polled: boolean;
	stored: number;
	duplicates: number;
	/** Malformed events passed (logged, never stored). */
	invalid?: number;
	cursor: string | null;
	expired?: boolean;
	/** The lease moved to another process during the poll: the cursor was not saved. */
	leaseLost?: boolean;
}

/**
 * The change-feed poller (plan 03 §C.4): the lossless channel next to webhooks. Reads
 * `/events?after=<cursor>&excludeOrigin=gauzy:<id>` page by page, stores the events it has not seen
 * (deduplicated with the webhook deliveries), and advances the cursor only past what was stored. A
 * `410 cursor_expired` asks for a resync (the reconcile pass) and restarts from the feed head; a 401
 * goes through the health check, which marks the connection `needs_reauth`.
 */
@Injectable()
export class EverWorksFeedPoller {
	private readonly logger = new Logger('EverWorksFeed');

	constructor(
		private readonly dataSource: DataSource,
		private readonly connections: EverWorksConnectionService,
		private readonly inbound: EverWorksInboundStore
	) {}

	/** Whether the connection's feed is due (fast while webhooks are quiet). */
	isDue(connection: EverWorksConnection, now: Date = new Date()): boolean {
		const last = (connection as EverWorksConnection & { lastFeedPollAt?: Date | null }).lastFeedPollAt;
		const lastWebhook = (connection as EverWorksConnection & { lastWebhookAt?: Date | null }).lastWebhookAt;
		if (!last) return true;
		const quiet = !lastWebhook || now.getTime() - new Date(lastWebhook).getTime() > WEBHOOK_QUIET_MS;
		return now.getTime() - new Date(last).getTime() >= (quiet ? FEED_POLL_FAST_MS : FEED_POLL_SLOW_MS);
	}

	/**
	 * Reads the feed on from the saved cursor. With `owner` (the sync loop's lease holder) the cursor is
	 * saved only while that process still holds the connection's lease; events stored meanwhile are
	 * deduplicated, so a stale poll never moves another owner's cursor.
	 */
	async poll(connection: EverWorksConnection, owner?: string): Promise<EverWorksFeedPollResult> {
		if (connection.status !== EverWorksConnectionStatus.ACTIVE) return { polled: false, stored: 0, duplicates: 0, cursor: connection.feedCursor ?? null };
		const client = this.connections.client(connection);
		let cursor = connection.feedCursor ?? null;
		let stored = 0;
		let duplicates = 0;
		let invalid = 0;
		try {
			if (cursor === null) {
				// Never polled: follow from now; history is the initial sync's job (plan 03 §C.6).
				cursor = String((await client.whoami()).feedHead ?? '0');
			}
			for (let page = 0; page < FEED_MAX_PAGES; page++) {
				const result = await client.events({ after: cursor, limit: 500, excludeOrigin: `gauzy:${connection.id}` });
				let last: string | null = cursor;
				for (const raw of result.events ?? []) {
					let envelope: EverWorksEventEnvelope;
					try {
						envelope = parseEverWorksEnvelope(raw);
					} catch (error) {
						if (!(error instanceof EverWorksEnvelopeError)) throw error;
						// One malformed event must not stop the feed: it is logged and passed (by its seq when
						// that is readable), and the events after it are read as usual.
						invalid++;
						const seq = (raw as { seq?: unknown } | null)?.seq;
						const readable = typeof seq === 'string' && /^\d{1,20}$/.test(seq) ? seq : null;
						if (readable && (last === null || compareSeq(readable, last) > 0)) last = readable;
						this.logger.warn(`Connection ${connection.id}: a malformed feed event was passed (${error.message.slice(0, 200)}).`);
						continue;
					}
					if (envelope.tenantId !== connection.ewTenantId) continue;
					const { duplicate } = await this.inbound.record(connection, envelope, 'feed');
					if (duplicate) duplicates++;
					else stored++;
					if (last === null || compareSeq(envelope.seq, last) > 0) last = envelope.seq;
				}
				cursor = result.nextCursor && (last === null || compareSeq(result.nextCursor, last) >= 0) ? result.nextCursor : last;
				if (!result.hasMore) break;
			}
			const saved = await this.save(connection.id as ID, { feedCursor: cursor, lastFeedPollAt: new Date() }, owner);
			return { polled: true, stored, duplicates, invalid, cursor, ...(saved ? {} : { leaseLost: true }) };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 410) {
				const head = String((await client.whoami().catch(() => null))?.feedHead ?? cursor ?? '0');
				await this.save(connection.id as ID, { feedCursor: head, lastFeedPollAt: new Date(), resyncRequestedAt: new Date() }, owner);
				this.logger.warn(`Connection ${connection.id}: the feed cursor expired; a resync is requested.`);
				return { polled: true, stored, duplicates, invalid, cursor: head, expired: true };
			}
			if (error instanceof EverWorksApiError && error.status === 401) {
				await this.connections.checkHealth(connection);
			}
			// Keep what was stored: the cursor stays before anything not yet stored.
			if (stored || duplicates || invalid) await this.save(connection.id as ID, { feedCursor: cursor, lastFeedPollAt: new Date() }, owner);
			throw error;
		}
	}

	/** Saves the feed position; with `owner`, only while that process holds the lease. True when saved. */
	private async save(id: ID, values: Record<string, unknown>, owner?: string): Promise<boolean> {
		const where = owner ? { id, leaseOwner: owner } : { id };
		const result = await this.dataSource.getRepository(EverWorksConnection).update(where as never, values as never);
		if (owner && !result.affected) {
			this.logger.warn(`Connection ${id}: the lease moved to another process during the feed poll; its cursor was not saved.`);
			return false;
		}
		return true;
	}
}
