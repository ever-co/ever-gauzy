import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, IntegrationEntity } from '@gauzy/contracts';
import { Comment, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { TrelloApiClient, TrelloApiError, TrelloAttachment, TrelloCard, TrelloCommentAction, TrelloMember } from '../client/trello-api.client';
import { attachmentLinkOf, commentHtmlOf } from './trello-card.mapper';

/** The employee (and their user) a comment is attributed to, by the member who wrote it. */
export interface TrelloAuthor {
	employeeId: ID;
	userId: ID | null;
}

/** What a run hands the details import: its scope, how to read Trello and match a member, and the tallies it keeps. */
export interface TrelloDetailsContext {
	scope: { tenantId: ID; organizationId: ID };
	integrationId: ID;
	/** The user who connected (the comments nobody here wrote are theirs to own). */
	connectedByUserId: ID | null;
	/** A read of Trello with the run's rate-limit waits. */
	read<T>(make: (client: TrelloApiClient) => Promise<T>): Promise<T>;
	/** The employee a Trello member is (by username, else by name), as the run matches card members. */
	authorOf(member: Pick<TrelloMember, 'id' | 'username' | 'fullName'> | null): Promise<TrelloAuthor | null>;
	details: { comments: number; links: number };
}

/**
 * A card's comments and attachments, brought in behind the card itself: every comment (a `commentCard` action)
 * becomes a comment of the platform task once — attributed to the employee the member is, else kept as the
 * connecting user's, marked `System`, and named after its member in the text — and follows an edit in Trello;
 * every attachment becomes a resource link of the task once (its name, the address that opens it), reusing a link
 * a person already added with the same address. Both are kept by the platform's id map (entities `Comment` and
 * `Attachment`), so a card read again adds nothing twice. Written through the entities' repositories, as the
 * platform's other integration does: the comment API states the author as its caller, which here is the sync.
 *
 * A comment or attachment that could not be applied is reported and left for the next read of the card; a refused
 * token stops the run, as it does for the cards.
 */
@Injectable()
export class TrelloCardDetailsService {
	private readonly logger = new Logger(TrelloCardDetailsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly integrationMapService: IntegrationMapService
	) {}

	/** The comments and attachments of one card, each once. */
	async apply(context: TrelloDetailsContext, card: TrelloCard, taskId: ID): Promise<void> {
		await this.applyComments(context, card, taskId);
		await this.applyAttachments(context, card, taskId);
	}

	private async applyComments(context: TrelloDetailsContext, card: TrelloCard, taskId: ID): Promise<void> {
		let comments: TrelloCommentAction[];
		try {
			comments = await context.read((client) => client.comments(card.id));
		} catch (caught) {
			if (caught instanceof TrelloApiError && caught.isUnauthorized) throw caught;
			this.logger.warn(`The comments of card ${card.id} could not be read: ${this.describe(caught)}`);
			return;
		}
		for (const action of comments) {
			try {
				await this.applyComment(context, action, taskId);
			} catch (caught) {
				this.logger.warn(`Comment ${action.id} of card ${card.id} could not be applied: ${this.describe(caught)}`);
			}
		}
	}

	private async applyComment(context: TrelloDetailsContext, action: TrelloCommentAction, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const author = await context.authorOf(action.memberCreator);
		const html = commentHtmlOf(action, !!author);
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
				actorType: author ? ActorTypeEnum.User : ActorTypeEnum.System,
				employeeId: author?.employeeId ?? undefined,
				createdByUserId: author?.userId ?? context.connectedByUserId ?? undefined,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			} as unknown as Comment)
		);
		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: action.id, entity: IntegrationEntity.COMMENT, ...scope })
		);
		context.details.comments += 1;
	}

	private async applyAttachments(context: TrelloDetailsContext, card: TrelloCard, taskId: ID): Promise<void> {
		let attachments: TrelloAttachment[];
		try {
			attachments = await context.read((client) => client.attachments(card.id));
		} catch (caught) {
			if (caught instanceof TrelloApiError && caught.isUnauthorized) throw caught;
			this.logger.warn(`The attachments of card ${card.id} could not be read: ${this.describe(caught)}`);
			return;
		}
		for (const attachment of attachments) {
			try {
				await this.applyAttachment(context, attachment, taskId);
			} catch (caught) {
				this.logger.warn(`Attachment ${attachment.id} of card ${card.id} could not be applied: ${this.describe(caught)}`);
			}
		}
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
