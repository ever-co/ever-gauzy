import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	BaseEntityEnum,
	ID,
	IInboxItemUpsertInput,
	IInboxItemWriter,
	INBOX_ITEM_WRITER,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import type { EverWorksEmailMessage, EverWorksEventEnvelope } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import type {
	EverWorksApplyContext,
	EverWorksApplyOutcome,
	EverWorksInboundHandler
} from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';

/** The aggregate of the `email.message.*` events (contract event catalog v1, CR-11). */
export const EVER_WORKS_EMAIL_AGGREGATE = 'email_message';

/** The Inbox identity of a mirrored message (`externalSource`; the Ever Works message id is the `externalId`). */
export const EVER_WORKS_EMAIL_EXTERNAL_SOURCE = 'ever_works_email';

/** The longest text body a mirrored item keeps (the full message stays in Ever Works, `webUrl`). */
export const MIRRORED_EMAIL_BODY_MAX = 100_000;

/** The Gauzy Inbox item of one Ever Works agent email (read-only: replying stays in Ever Works). */
export function mirroredEmailUpsertOf(
	message: EverWorksEmailMessage,
	scope: { tenantId: ID; organizationId: ID; recipientUserId: ID },
	links: { taskId: ID | null; agentEmployeeId: ID | null; agentName: string | null }
): IInboxItemUpsertInput {
	const agent = links.agentName || 'agent';
	return {
		tenantId: scope.tenantId,
		organizationId: scope.organizationId,
		kind: InboxItemKindEnum.EMAIL,
		source: InboxItemSourceEnum.EVER_WORKS,
		externalSource: EVER_WORKS_EMAIL_EXTERNAL_SOURCE,
		externalId: message.id,
		title: ((message.subject ?? '').trim() || '(no subject)').slice(0, 300),
		body: (message.text ?? '').slice(0, MIRRORED_EMAIL_BODY_MAX) || null,
		bodyFormat: InboxItemBodyFormatEnum.PLAIN,
		priority: InboxItemPriorityEnum.NORMAL,
		entity: links.taskId ? BaseEntityEnum.Task : null,
		entityId: links.taskId,
		taskId: links.taskId,
		agentEmployeeId: links.agentEmployeeId,
		metadata: {
			// The virtual mailbox the item is listed under (plan 04 §6: "Ever Works — <agent>").
			mailbox: `Ever Works — ${agent}`,
			readOnly: true,
			from: message.from ?? null,
			to: message.to ?? [],
			cc: message.cc ?? [],
			direction: message.direction ?? null,
			attachments: (message.attachments ?? []).length,
			everWorks: {
				id: message.id,
				version: message.version ?? null,
				agentId: message.agentId ?? null,
				taskId: message.taskId ?? null,
				conversationId: message.conversationId ?? null,
				status: message.status ?? null,
				deliveryStatus: message.deliveryStatus ?? null,
				webUrl: message.webUrl ?? null
			}
		},
		recipients: [{ userId: scope.recipientUserId }],
		// The owner's pairing may be replaced: the former Gauzy user stops reading the copy.
		replaceRecipients: true
	};
}

/**
 * The read-only mirror of Ever Works agent mail, Ever Works → Gauzy (plan 04 §6, G-P4-6 part 2; CR-11): the
 * `email.message.received|sent|status_changed` events (recipient-scoped, served to a key holding `email:read`) become
 * Gauzy Inbox `EMAIL` items (`source = EVER_WORKS`, identity `ever_works_email` / the EW message id) of the Gauzy user
 * paired with the agent's owner, listed under the virtual mailbox "Ever Works — <agent>", linked to the agent employee
 * and the task. They are copies to read: a reply stays in Ever Works.
 *
 * - **Optional, per mapping:** the `agentEmail` direction (`ew_to_gauzy` | `off`, default **off**); off, the events are
 *   skipped (not left deferred).
 * - A message Gauzy handed to the agent itself (the bridge's `AGENT_EMAIL` link) is already in the Gauzy Inbox: skipped.
 * - An owner not paired yet waits (deferred, like the inbox) until the People tab pairs them.
 * - An event whose body was left out (over 256 KiB) is completed from `GET /email/messages/:id`.
 */
@Injectable()
export class EverWorksAgentEmailMirror implements EverWorksInboundHandler {
	readonly aggregateTypes = [EVER_WORKS_EMAIL_AGGREGATE];

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly links: EverWorksLinkService,
		private readonly connections: EverWorksConnectionService,
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null
	) {}

	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if ((context.directions as Record<string, string | undefined>)['agentEmail'] !== 'ew_to_gauzy') {
			return { status: 'skipped', message: 'agent mail is not mirrored (the agentEmail direction is off)' };
		}
		if (!this.inbox) {
			// Switched on but not loaded in this process: a process that hosts the Inbox applies it.
			return process.env['GAUZY_INBOX_ENABLED'] === 'true'
				? { status: 'deferred', message: 'the Gauzy Inbox is not loaded in this process' }
				: { status: 'skipped', message: 'the Gauzy Inbox is off (GAUZY_INBOX_ENABLED)' };
		}
		let message = { ...((envelope.data ?? {}) as unknown as EverWorksEmailMessage), id: envelope.aggregate.id };
		const handedOff = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT_EMAIL, message.id);
		if (handedOff)
			return {
				status: 'skipped',
				message: 'handed to the agent from Gauzy: the message is in the Gauzy Inbox already'
			};
		const link = await this.links.byEw(
			context.integrationTenantId,
			EverWorksLinkType.AGENT_EMAIL_MIRROR,
			message.id
		);
		const version = envelope.aggregate.version ?? message.version ?? null;
		if (link?.ewVersion != null && version != null && version <= link.ewVersion) {
			return { status: 'skipped', message: 'already applied (version)' };
		}
		if (!message.ownerUserId) return { status: 'skipped', message: 'the message names no owner' };
		const recipientUserId = await this.gauzyUserOf(context, message.ownerUserId);
		if (!recipientUserId) {
			return {
				status: 'deferred',
				message: `the agent's owner (Ever Works user ${message.ownerUserId}) is not matched to a Gauzy member yet: match them on the People tab`
			};
		}
		if (message.bodyOmitted) {
			// Over 256 KiB the event carries no body: the message itself has it.
			message = await this.connections
				.client(context.connection, context.everWorksOrganizationSlug)
				.request<EverWorksEmailMessage>('GET', `/email/messages/${encodeURIComponent(message.id)}`);
		}
		const agent = message.agentId
			? await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, message.agentId)
			: null;
		const live = agent && agent.state !== EverWorksLinkState.UNLINKED ? agent : null;
		const task = message.taskId
			? await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, message.taskId)
			: null;
		const result = await this.inbox.upsertExternal(
			mirroredEmailUpsertOf(
				message,
				{ tenantId: context.tenantId, organizationId: context.organizationId, recipientUserId },
				{
					taskId: (task?.gauzyId as ID | undefined) ?? null,
					agentEmployeeId: (live?.gauzyId as ID | undefined) ?? null,
					agentName: (this.links.snapshot<{ name?: string }>(live).name as string | undefined) ?? null
				}
			)
		);
		if (!result.recipientUserIds.includes(recipientUserId)) {
			return { status: 'deferred', message: 'the matched Gauzy user is not a user of this tenant' };
		}
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.AGENT_EMAIL_MIRROR,
			gauzyId: result.item.id as ID,
			ewId: message.id,
			ewVersion: version,
			ewUpdatedAt: message.updatedAt ?? null,
			direction: 'inbound'
		});
		return { status: 'applied' };
	}

	/** The Gauzy user paired with an Ever Works user (MEMBER link → employee of the organization). */
	private async gauzyUserOf(context: EverWorksMappingContext, ewUserId: string): Promise<ID | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId);
		if (!link?.gauzyId || link.state === EverWorksLinkState.UNLINKED) return null;
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { id: link.gauzyId, tenantId: context.tenantId, organizationId: context.organizationId },
			select: { id: true, userId: true }
		});
		return (employee?.userId as ID | undefined) ?? null;
	}
}
