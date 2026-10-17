import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	declareStreamedEvents,
	EventOutboxService,
	GraphqlSubscriptionConsumer,
	SubscriptionCatalogue
} from '@gauzy/core';
import type { InboxItem } from '../entities/inbox-item.entity';

/** The fact appended when an item reaches someone's Inbox (plan 04 §3, G-P3-6). */
export const INBOX_ITEM_CREATED = 'inbox_item.created';

/** The aggregate the Inbox events are about. */
export const INBOX_ITEM_AGGREGATE = 'inbox_item';

/**
 * The Inbox facts the subscription surface streams: `inbox_item.created`.
 *
 * **Addressed, and content-free.** The payload names its recipients (`recipientUserIds`), which makes the event
 * addressed: the kernel delivers it to the subscriptions of those users only (`Subscription.events`, and any
 * tenant-topic stream), never to another user of the tenant who holds the stream's permission. The payload
 * carries the item's identity, kind, source, status and priority — never its title, body or answer — because the
 * same row is listed by `GET /events/outbox` and can be delivered to a tenant's webhooks: a client that is told an
 * item arrived reads it through the recipient-scoped Inbox API.
 *
 * A typed field of the Inbox's own (`inboxItemCreated`, for holders of `INBOX_VIEW`) is a follow-up: the schema
 * snapshot and the field-binding gate read the schema with the flag off, where a flag-gated plugin's SDL is absent.
 */
export const INBOX_STREAMED_EVENTS: readonly string[] = ['inbox_item.created'];

/** What `inbox_item.created` carries. */
export interface IInboxItemCreatedData {
	id: ID;
	kind: string;
	source: string;
	status: string;
	priority: string;
	organizationId: ID | null;
	mailboxId: ID | null;
	/** The users the item was delivered to: the event reaches their subscriptions only. */
	recipientUserIds: ID[];
}

/** The payload of `inbox_item.created` for an item and the users it was delivered to. */
export function inboxItemCreatedData(
	item: Pick<InboxItem, 'id' | 'kind' | 'source' | 'status' | 'priority' | 'organizationId' | 'mailboxId'>,
	recipientUserIds: ReadonlyArray<ID>
): IInboxItemCreatedData {
	return {
		id: item.id as ID,
		kind: String(item.kind),
		source: String(item.source),
		status: String(item.status),
		priority: String(item.priority),
		organizationId: (item.organizationId as ID) ?? null,
		mailboxId: (item.mailboxId as ID) ?? null,
		recipientUserIds: [...new Set(recipientUserIds)]
	};
}

/**
 * Real time for the Inbox (plan 06 G-P3-6): appends `inbox_item.created` to the platform outbox when an item is
 * created, and declares it with the subscription catalogue, so the outbox consumer publishes it on the tenant's
 * topic and the subscription surface delivers it to the item's recipients.
 *
 * The platform pieces are looked up, not injected: the Inbox also runs in processes without a subscription
 * surface (the worker), where only the outbox (when present) is written and nothing is declared. Nothing here
 * can fail an Inbox write: the event is a hint to refetch, the 60-second count poll of the header badge stays,
 * and a failed append is logged.
 */
@Injectable()
export class InboxRealtime implements OnModuleInit {
	private readonly logger = new Logger('InboxRealtime');

	constructor(
		private readonly dataSource: DataSource,
		private readonly moduleRef: ModuleRef
	) {}

	/** Declares {@link INBOX_STREAMED_EVENTS}, where this process serves subscriptions. */
	onModuleInit(): void {
		const catalogue = this.find(SubscriptionCatalogue);
		if (!catalogue) return;
		try {
			declareStreamedEvents(catalogue, this.find(GraphqlSubscriptionConsumer), ...INBOX_STREAMED_EVENTS);
		} catch (error) {
			this.logger.warn(`The Inbox events could not be declared for subscriptions: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Appends `inbox_item.created` for an item created for these users. An item nobody receives appends nothing.
	 * Appended after the item and its recipients are written (they are not one transaction): a lost event costs
	 * a recipient the instant update, not the item.
	 */
	async itemCreated(
		item: Pick<
			InboxItem,
			'id' | 'tenantId' | 'kind' | 'source' | 'status' | 'priority' | 'organizationId' | 'mailboxId'
		>,
		recipientUserIds: ReadonlyArray<ID>
	): Promise<void> {
		if (!item?.id || !item.tenantId || !recipientUserIds?.length) return;
		const outbox = this.find(EventOutboxService);
		if (!outbox) return;
		try {
			await outbox.append(this.dataSource.manager, {
				name: INBOX_ITEM_CREATED,
				aggregateType: INBOX_ITEM_AGGREGATE,
				aggregateId: item.id as ID,
				tenantId: item.tenantId as ID,
				// A tenant-wide item stays tenant-wide: the writing request's organization is not stamped on it.
				...(item.organizationId ? { organizationId: item.organizationId as ID } : { tenantWide: true }),
				data: inboxItemCreatedData(item, recipientUserIds) as unknown as Record<string, unknown>
			});
		} catch (error) {
			this.logger.warn(`inbox_item.created was not appended for item ${item.id}: ${(error as Error)?.message}`);
		}
	}

	/** A platform provider of this process, or `undefined` when it has none. */
	private find<T>(token: Type<T> | undefined): T | undefined {
		if (!token) return undefined;
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
