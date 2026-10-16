import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
	ID,
	IInboxItem,
	IInboxItemRecipient,
	IInboxItemWriter,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	IInboxSourceHandler,
	IInboxSourceHandlerRegistry,
	IInboxSourceReplyResult,
	INBOX_ITEM_WRITER,
	INBOX_SOURCE_HANDLER_REGISTRY,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import {
	EVER_WORKS_INBOX_REPLY_MAX,
	EverWorksEventEnvelope,
	EverWorksInboxItem,
	EverWorksInboxReplyResult
} from '../client/ever-works-client.types';
import { EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import {
	EverWorksApplyContext,
	EverWorksApplyOutcome,
	EverWorksInboundHandler
} from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import {
	EVER_WORKS_INBOX_EXTERNAL_SOURCE,
	EverWorksInboxLinks,
	everWorksStateOf,
	inboxUpsertOf
} from './ever-works-inbox.mapper';

/** The aggregate type of the `inbox.item.*` events (B.4 catalog). */
export const EVER_WORKS_INBOX_AGGREGATE = 'inbox_item';

/**
 * The Ever Works inbox in the Gauzy Inbox (plan 04 §4, G-P3-3).
 *
 * - **EW → G:** the `inbox.item.*` events (served to a key holding `inbox:read`, recipient-scoped, CR-4)
 *   become Gauzy Inbox items (`source = EVER_WORKS`, identity `ever_works` / the EW id) for the Gauzy user
 *   matched to the EW recipient. An item whose recipient is not matched yet waits as `deferred` (retried
 *   hourly) until the admin matches the person on the People tab.
 * - **G → EW:** the `EVER_WORKS` source handler. A reply goes to `POST /inbox/items/:id/reply` acting as the
 *   recipient (synchronously, so "already decided in Ever Works" reaches the user); read / unread and archive
 *   go to `PATCH /inbox/items/:id/state`. Snoozing stays in Gauzy.
 *
 * Both are optional: where the Gauzy Inbox is off (the default) nothing registers and the events are skipped.
 */
@Injectable()
export class EverWorksInboxService implements EverWorksInboundHandler, OnModuleInit, OnModuleDestroy {
	readonly aggregateTypes = [EVER_WORKS_INBOX_AGGREGATE];
	private readonly logger = new Logger('EverWorksInbox');

	/** The source handler the Gauzy Inbox calls for `EVER_WORKS` items. */
	readonly handler: IInboxSourceHandler = {
		source: InboxItemSourceEnum.EVER_WORKS,
		onReply: (item, reply, actor) => this.reply(item, reply, actor),
		onStateChange: (item, recipient, change) => this.mirrorState(item, recipient, change)
	};

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly links: EverWorksLinkService,
		private readonly connections: EverWorksConnectionService,
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null,
		@Optional()
		@Inject(INBOX_SOURCE_HANDLER_REGISTRY)
		private readonly registry?: IInboxSourceHandlerRegistry | null
	) {}

	onModuleInit(): void {
		if (!this.registry) return;
		try {
			this.registry.register(this.handler);
		} catch (error) {
			this.logger.warn(
				`The EVER_WORKS inbox source handler was not registered (${error instanceof Error ? error.message : 'error'}).`
			);
		}
	}

	onModuleDestroy(): void {
		if (this.registry?.get(InboxItemSourceEnum.EVER_WORKS) === this.handler) {
			this.registry.unregister(InboxItemSourceEnum.EVER_WORKS);
		}
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `inbox.item.created` / `answered` / `state_changed` / `deleted`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		if (!this.inbox) {
			// Switched on but not loaded in this process (a worker that does not host the Inbox): leave the event
			// for a process that does, rather than finish it unapplied.
			return process.env['GAUZY_INBOX_ENABLED'] === 'true'
				? { status: 'deferred', message: 'the Gauzy Inbox is not loaded in this process' }
				: { status: 'skipped', message: 'the Gauzy Inbox is off (GAUZY_INBOX_ENABLED)' };
		}
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (context.directions.inbox === 'off') return { status: 'skipped', message: 'the inbox is not synced' };

		const item = { ...((envelope.data ?? {}) as unknown as EverWorksInboxItem), id: envelope.aggregate.id };
		if (!item.recipientUserId) return { status: 'skipped', message: 'the inbox item names no recipient' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.INBOX_ITEM, item.id);
		const version = envelope.aggregate.version ?? null;
		if (link?.ewVersion != null && version != null && version <= link.ewVersion) {
			return { status: 'skipped', message: 'already applied (version)' };
		}

		const recipientUserId = await this.gauzyUserOf(context, item.recipientUserId);
		if (!recipientUserId) {
			return {
				status: 'deferred',
				message: `the recipient (Ever Works user ${item.recipientUserId}) is not matched to a Gauzy member yet: match them on the People tab`
			};
		}
		const result = await this.inbox.upsertExternal(
			inboxUpsertOf(
				item,
				{ tenantId: context.tenantId, organizationId: context.organizationId, recipientUserId },
				await this.linksOf(context, item),
				{ deleted: envelope.type === 'inbox.item.deleted' }
			)
		);
		if (!result.recipientUserIds.includes(recipientUserId)) {
			return { status: 'deferred', message: 'the matched Gauzy user is not a user of this tenant' };
		}
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.INBOX_ITEM,
			gauzyId: result.item.id as ID,
			ewId: item.id,
			ewVersion: version,
			ewUpdatedAt: item.updatedAt ?? null,
			direction: 'inbound'
		});
		return { status: 'applied' };
	}

	// ── G → EW (the EVER_WORKS source handler) ─────────────────────────────────────────────────────

	/**
	 * A reply in Gauzy → `POST /inbox/items/:id/reply`, acting as the replying user's Ever Works account (Ever
	 * Works takes it only from the item's recipient). Lost races and answers given in Ever Works first come
	 * back as `routed: 'already-decided'` with the answer Ever Works holds.
	 */
	async reply(
		item: IInboxItem,
		reply: IInboxReplyInput,
		actor: { id: ID; tenantId?: ID }
	): Promise<IInboxSourceReplyResult> {
		const { context, ewItemId } = await this.contextOf(item);
		const ewUserId = await this.everWorksUserOf(context, actor.id);
		if (!ewUserId) {
			throw new ForbiddenException(
				'Your Gauzy account is not matched to an Ever Works member, so the reply cannot be sent as you. Ask an admin to match you on Integrations → Ever Works → People.'
			);
		}
		const text = typeof reply?.text === 'string' && reply.text.trim() ? reply.text.trim() : null;
		const optionId = typeof reply?.optionId === 'string' && reply.optionId ? reply.optionId : null;
		if (text && text.length > EVER_WORKS_INBOX_REPLY_MAX) {
			throw new BadRequestException(
				`Ever Works takes a reply of at most ${EVER_WORKS_INBOX_REPLY_MAX} characters.`
			);
		}
		const client = this.client(context);
		// The same reply sent again (a timeout, a retry) replays the first answer; another reply is a new one.
		const idempotencyKey = createHash('sha256')
			.update(`${context.connection.id}:inbox:${ewItemId}:reply:${ewUserId}:${optionId ?? ''}:${text ?? ''}`)
			.digest('hex');
		try {
			const result = await client.request<EverWorksInboxReplyResult>(
				'POST',
				`/inbox/items/${encodeURIComponent(ewItemId)}/reply`,
				{
					body: { text, optionId },
					actAsUserId: ewUserId,
					idempotencyKey
				}
			);
			if (result?.routed === 'already-decided') {
				return { routed: 'already-decided', response: answerOf(result.item) };
			}
			return { routed: result?.routed || 'delivered' };
		} catch (error) {
			return this.refused(error, client, ewItemId);
		}
	}

	/** Read / unread and archive in Gauzy → `PATCH /inbox/items/:id/state` (snoozing stays in Gauzy). */
	async mirrorState(
		item: IInboxItem,
		recipient: IInboxItemRecipient,
		change: IInboxRecipientStateInput
	): Promise<void> {
		const state = everWorksStateOf(change);
		if (!state) return;
		const { context, ewItemId } = await this.contextOf(item);
		const ewUserId = await this.everWorksUserOf(context, recipient.userId as ID);
		if (!ewUserId) {
			this.logger.warn(
				`Inbox item ${item.id}: the recipient is not matched to an Ever Works member; the state stays in Gauzy.`
			);
			return;
		}
		await this.client(context).request<EverWorksInboxItem>(
			'PATCH',
			`/inbox/items/${encodeURIComponent(ewItemId)}/state`,
			{
				body: state,
				actAsUserId: ewUserId
			}
		);
	}

	// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

	/** Ever Works' refusal of a reply, as the Gauzy user should read it. */
	private async refused(error: unknown, client: EverWorksClient, ewItemId: string): Promise<IInboxSourceReplyResult> {
		if (error instanceof EverWorksApiError) {
			switch (error.status) {
				case 409: {
					// Answered or archived in Ever Works before this reply.
					const current = await client
						.request<EverWorksInboxItem>('GET', `/inbox/items/${encodeURIComponent(ewItemId)}`)
						.catch(() => undefined);
					if (current === undefined) {
						// The re-read failed: the item may well be answered there; say so, and let the user retry.
						throw new ServiceUnavailableException(
							'Ever Works refused the reply, and what it holds for the item could not be read. Try again later.'
						);
					}
					if (current?.answeredAt) return { routed: 'already-decided', response: answerOf(current) };
					throw new ConflictException(
						'Already decided in Ever Works: the item was archived there and takes no reply.'
					);
				}
				case 404:
					throw new NotFoundException('This item no longer exists in Ever Works.');
				case 403:
					throw new ForbiddenException(
						error.code === 'act_as_forbidden'
							? 'Ever Works takes a reply only from the person the item is addressed to.'
							: 'The Ever Works integration key may not answer inbox items (it needs the inbox:write scope).'
					);
				case 400:
				case 422:
					throw new BadRequestException(`Ever Works refused the reply: ${error.message}`);
				case 401:
					throw new ServiceUnavailableException(
						'Ever Works no longer accepts the integration key; an admin needs to enter a new one.'
					);
			}
		}
		throw new ServiceUnavailableException('Ever Works did not take the reply. Try again later.');
	}

	/** The mapping of a synced item and its Ever Works id; refuses an item that is not (or no longer) synced. */
	private async contextOf(item: IInboxItem): Promise<{ context: EverWorksMappingContext; ewItemId: string }> {
		if (item.externalSource !== EVER_WORKS_INBOX_EXTERNAL_SOURCE || !item.externalId) {
			throw new BadRequestException('This inbox item does not come from Ever Works.');
		}
		const context =
			item.tenantId && item.organizationId
				? await this.contexts.forOrganization(item.tenantId as ID, item.organizationId as ID)
				: null;
		if (
			!context ||
			!context.isEnabled ||
			context.directions.inbox === 'off' ||
			context.connection.status !== EverWorksConnectionStatus.ACTIVE
		) {
			throw new ServiceUnavailableException(
				'Ever Works is not connected for this organization right now. Try again later.'
			);
		}
		return { context, ewItemId: item.externalId };
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}

	/** The Gauzy user matched to an Ever Works user (MEMBER link: EW user ↔ G employee of the organization). */
	private async gauzyUserOf(context: EverWorksMappingContext, ewUserId: string): Promise<ID | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId);
		if (!link?.gauzyId) return null;
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { id: link.gauzyId, tenantId: context.tenantId, organizationId: context.organizationId },
			select: { id: true, userId: true }
		});
		return (employee?.userId as ID | undefined) ?? null;
	}

	/** The Ever Works user matched to a Gauzy user, through that user's employee in the organization. */
	private async everWorksUserOf(context: EverWorksMappingContext, userId: ID): Promise<string | null> {
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { userId, tenantId: context.tenantId, organizationId: context.organizationId },
			select: { id: true }
		});
		if (!employee?.id) return null;
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employee.id as ID);
		return link?.ewId ?? null;
	}

	/** The Gauzy task, project and agent of an item, through the integration's links (unlinked → `null`). */
	private async linksOf(context: EverWorksMappingContext, item: EverWorksInboxItem): Promise<EverWorksInboxLinks> {
		const gauzyIdOf = async (type: EverWorksLinkType, ewId: string | null | undefined): Promise<ID | null> =>
			ewId
				? (((await this.links.byEw(context.integrationTenantId, type, ewId))?.gauzyId as ID | undefined) ??
					null)
				: null;
		return {
			taskId: await gauzyIdOf(EverWorksLinkType.TASK, item.taskId),
			projectId: await gauzyIdOf(EverWorksLinkType.PROJECT_WORK, item.workId),
			agentEmployeeId: await gauzyIdOf(EverWorksLinkType.AGENT, item.agentId)
		};
	}
}

/** The answer Ever Works holds for an item (the inbox records it in place of the reply sent). */
function answerOf(item: EverWorksInboxItem | null | undefined): IInboxSourceReplyResult['response'] {
	if (!item) return null;
	return {
		text: item.answerText ?? null,
		optionId: item.answerOptionId ?? null,
		answeredAt: item.answeredAt ?? null
	};
}
