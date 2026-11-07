import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, IntegrationEntity } from '@gauzy/contracts';
import { Comment, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { TrelloApiClient, TrelloApiError, TrelloAttachment, TrelloCard, TrelloCommentAction } from '../client/trello-api.client';
import { attachmentLinkOf, commentHtmlOf } from './trello-card.mapper';

/** What a run hands the details import: its scope, how to read Trello, and the tallies it keeps. */
export interface TrelloDetailsContext {
	scope: { tenantId: ID; organizationId: ID };
	integrationId: ID;
	/** The user who connected: every imported comment is theirs to own (see the class comment). */
	connectedByUserId: ID | null;
	/** A read of Trello with the run's rate-limit waits. */
	read<T>(make: (client: TrelloApiClient) => Promise<T>): Promise<T>;
	/** What the details import brought in, and what it could not read or keep (a failure of the run: the position is kept). */
	details: { comments: number; links: number; failed: number };
}

/** A card's details as read from Trello, before anything is written. */
export interface TrelloCardDetails {
	comments: TrelloCommentAction[];
	attachments: TrelloAttachment[];
}

/**
 * A card's comments and attachments, brought in behind the card itself: every comment (a `commentCard` action)
 * becomes a comment of the platform task once — kept as the connecting user's, marked `System`, and named after
 * its Trello member in the text: a member's username and display name are chosen by the member (a board guest can
 * take anyone's), and only the token's own member has an e-mail, so a comment is never attributed to an employee
 * from them — and follows an edit in Trello; every attachment becomes a resource link of the task once (its name,
 * the address that opens it), reusing a link a person already added with the same address. Both are kept by the
 * platform's id map (entities `Comment` and `Attachment`), so a card read again adds nothing twice. Written
 * through the entities' repositories, as the platform's other integration does.
 *
 * The reads ({@link collect}) and the writes ({@link apply}) are apart: the caller reads with no lock held and
 * writes one run at a time per card, so two runs that meet on one card (a webhook and an import) never both find
 * no mapped comment and keep it twice. A comment or attachment that could not be read or kept is reported and
 * counted as a failure of the run — the import position is then kept and the next import reads the card again;
 * a refusal of one resource (403, 404) is not counted, a retry changes nothing. A refused token stops the run.
 */
@Injectable()
export class TrelloCardDetailsService {
	private readonly logger = new Logger(TrelloCardDetailsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly integrationMapService: IntegrationMapService
	) {}

	/** Reads the card's comments and attachments (two calls); what could not be read is counted and left empty. */
	async collect(context: TrelloDetailsContext, card: TrelloCard): Promise<TrelloCardDetails> {
		return {
			comments: await this.readPart(context, card, 'comments', (client) => client.comments(card.id)),
			attachments: await this.readPart(context, card, 'attachments', (client) => client.attachments(card.id))
		};
	}

	/** Keeps what was read, each once. */
	async apply(context: TrelloDetailsContext, card: TrelloCard, details: TrelloCardDetails, taskId: ID): Promise<void> {
		for (const action of details.comments) {
			try {
				await this.applyComment(context, action, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Comment ${action.id} of card ${card.id} could not be kept: ${this.describe(caught)}`);
			}
		}
		for (const attachment of details.attachments) {
			try {
				await this.applyAttachment(context, attachment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Attachment ${attachment.id} of card ${card.id} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	private async readPart<T>(context: TrelloDetailsContext, card: TrelloCard, what: string, make: (client: TrelloApiClient) => Promise<T[]>): Promise<T[]> {
		try {
			return await context.read(make);
		} catch (caught) {
			if (caught instanceof TrelloApiError && caught.isUnauthorized) throw caught;
			if (!(caught instanceof TrelloApiError && (caught.isForbidden || caught.isNotFound))) context.details.failed += 1;
			this.logger.warn(`The ${what} of card ${card.id} could not be read: ${this.describe(caught)}`);
			return [];
		}
	}

	private async applyComment(context: TrelloDetailsContext, action: TrelloCommentAction, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const html = commentHtmlOf(action);
		if (!html) return;
		const comments = this.dataSource.getRepository(Comment);
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.COMMENT, sourceId: action.id, integrationId, ...scope })
			.catch(() => null);
		if (existing?.gauzyId) {
			// Edited in Trello: the platform's copy follows; the same words are left alone.
			const row = await comments.findOne({ where: { id: existing.gauzyId, tenantId: scope.tenantId } as never, select: { id: true, comment: true } as never });
			if (row && row.comment !== html) {
				await comments.update({ id: existing.gauzyId } as never, { comment: html, editedAt: new Date() } as never);
			}
			return;
		}
		const saved = await comments.save(
			comments.create({
				entity: BaseEntityEnum.Task,
				entityId: taskId,
				comment: html,
				actorType: ActorTypeEnum.System,
				createdByUserId: context.connectedByUserId ?? undefined,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			} as unknown as Comment)
		);
		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: action.id, entity: IntegrationEntity.COMMENT, ...scope })
		);
		context.details.comments += 1;
	}

	private async applyAttachment(context: TrelloDetailsContext, attachment: TrelloAttachment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const link = attachmentLinkOf(attachment);
		if (!link) return;
		const links = this.dataSource.getRepository(ResourceLink);
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ATTACHMENT, sourceId: attachment.id, integrationId, ...scope })
			.catch(() => null);
		if (existing?.gauzyId) {
			// Renamed in Trello: the link follows; a person's link reused below is never rewritten (it is not mapped).
			const row = await links.findOne({ where: { id: existing.gauzyId, tenantId: scope.tenantId } as never, select: { id: true, title: true, url: true } as never });
			if (row && (row.title !== link.title || row.url !== link.url)) {
				await links.update({ id: existing.gauzyId } as never, { title: link.title, url: link.url } as never);
			}
			return;
		}
		// A link a person already added with this address is the attachment's: reused as it is, and never mapped.
		const same = await links.findOne({ where: { tenantId: scope.tenantId, entity: BaseEntityEnum.Task, entityId: taskId, url: link.url } as never, select: { id: true } as never });
		if (same) return;
		const saved = await links.save(
			links.create({
				entity: BaseEntityEnum.Task,
				entityId: taskId,
				title: link.title,
				url: link.url,
				createdByUserId: context.connectedByUserId ?? undefined,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			} as unknown as ResourceLink)
		);
		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: attachment.id, entity: IntegrationEntity.ATTACHMENT, ...scope })
		);
		context.details.links += 1;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
