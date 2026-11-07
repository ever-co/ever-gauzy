import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { LinearAttachment, LinearComment, LinearIssue } from '../client/linear-api.client';
import { attachmentLinkOf, commentHtmlOf } from './linear-issue.mapper';

/** The employee (and their user) a comment is attributed to, by the e-mail Linear gives for its author. */
export interface LinearAuthor {
	employeeId: ID;
	userId: ID | null;
}

/** What a run hands the details import: its scope and the caches and tallies it keeps. */
export interface LinearDetailsContext {
	scope: { tenantId: ID; organizationId: ID };
	integrationId: ID;
	/** The user who connected (the comments nobody here wrote are theirs to own). */
	connectedByUserId: ID | null;
	authorsByEmail: Map<string, LinearAuthor | null>;
	/** What the details import brought in, and what it could not keep (a failure of the run: the position is kept). */
	details: { comments: number; links: number; failed: number };
}

/**
 * An issue's comments and attachments, brought in behind the issue itself (they come with it: no further read).
 * Every comment becomes a comment of the platform task once — attributed to the employee whose user has the
 * author's e-mail, else kept as the connecting user's, marked `System`, and named after its author in the text —
 * under the comment it answers when that one is in, and follows an edit in Linear; every attachment becomes a
 * resource link of the task once (its title, the address that opens it), reusing a link a person already added
 * with the same address. Both are kept by the platform's id map (entities `Comment` and `Attachment`), so an issue
 * read again adds nothing twice. Written through the entities' repositories, as the platform's other integration
 * does: the comment API states the author as its caller, which here is the sync, not the person who wrote in Linear.
 *
 * Written one run at a time per issue by the caller (under the issue's lock), so two runs that meet on one issue
 * never both find no mapped comment and keep it twice. A comment or attachment that could not be kept is reported
 * and counted as a failure of the run: the import position is then kept and the next import reads the issue again.
 */
@Injectable()
export class LinearIssueDetailsService {
	private readonly logger = new Logger(LinearIssueDetailsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly integrationMapService: IntegrationMapService,
		private readonly employeeService: EmployeeService
	) {}

	/** The comments and attachments of one issue, each once. */
	async apply(context: LinearDetailsContext, issue: LinearIssue, taskId: ID): Promise<void> {
		for (const comment of issue.comments?.nodes ?? []) {
			try {
				await this.applyComment(context, comment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Comment ${comment.id} of issue ${issue.identifier} could not be kept: ${this.describe(caught)}`);
			}
		}
		for (const attachment of issue.attachments?.nodes ?? []) {
			try {
				await this.applyAttachment(context, attachment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Attachment ${attachment.id} of issue ${issue.identifier} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	private async applyComment(context: LinearDetailsContext, comment: LinearComment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const author = await this.authorOf(context, comment.user?.email ?? null);
		const html = commentHtmlOf(comment, !!author);
		if (!html) return;
		const comments = this.dataSource.getRepository(Comment);
		const existing = await this.mapOf(context, IntegrationEntity.COMMENT, comment.id);
		if (existing) {
			// Edited in Linear: the platform's copy follows, as it was attributed when it was kept (an author matched only
			// now does not lose the name line a System comment carries); the same words are left alone.
			const row = await comments.findOne({ where: { id: existing, tenantId: scope.tenantId } as never, select: { id: true, comment: true, employeeId: true } as never });
			if (!row) return;
			const stored = commentHtmlOf(comment, !!row.employeeId);
			if (row.comment !== stored) {
				await comments.update({ id: existing } as never, { comment: stored, editedAt: new Date() } as never);
			}
			return;
		}
		// A reply goes under the comment it answers when that one is in (the comments come oldest first, so it usually is).
		const parentId = comment.parent?.id ? await this.mapOf(context, IntegrationEntity.COMMENT, comment.parent.id) : null;
		const saved = await comments.save(
			comments.create({
				entity: BaseEntityEnum.Task,
				entityId: taskId,
				comment: html,
				actorType: author ? ActorTypeEnum.User : ActorTypeEnum.System,
				employeeId: author?.employeeId ?? undefined,
				createdByUserId: author?.userId ?? context.connectedByUserId ?? undefined,
				parentId: parentId ?? undefined,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			} as unknown as Comment)
		);
		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: comment.id, entity: IntegrationEntity.COMMENT, ...scope })
		);
		context.details.comments += 1;
	}

	private async applyAttachment(context: LinearDetailsContext, attachment: LinearAttachment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const link = attachmentLinkOf(attachment);
		if (!link) return;
		const links = this.dataSource.getRepository(ResourceLink);
		const existing = await this.mapOf(context, IntegrationEntity.ATTACHMENT, attachment.id);
		if (existing) {
			// Retitled in Linear: the link follows; a person's link reused below is never rewritten (it is not mapped).
			const row = await links.findOne({ where: { id: existing, tenantId: scope.tenantId } as never, select: { id: true, title: true, url: true } as never });
			if (row && (row.title !== link.title || row.url !== link.url)) {
				await links.update({ id: existing } as never, { title: link.title, url: link.url } as never);
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

	/** The platform id a Linear record was kept as, or null. */
	private async mapOf(context: LinearDetailsContext, entity: IntegrationEntity, sourceId: string): Promise<ID | null> {
		const map = await this.integrationMapService
			.findOneByWhereOptions({ entity, sourceId, integrationId: context.integrationId, ...context.scope })
			.catch(() => null);
		return (map?.gauzyId as ID | undefined) ?? null;
	}

	/** The employee (and user) with the author's e-mail in the organization, once per e-mail per run; null when none (or no e-mail). */
	private async authorOf(context: LinearDetailsContext, email: string | null): Promise<LinearAuthor | null> {
		const key = email?.trim().toLowerCase();
		if (!key) return null;
		if (!context.authorsByEmail.has(key)) {
			try {
				const { items } = await this.employeeService.findAll({
					where: { ...context.scope, isActive: true, isArchived: false, user: { email: In([key, email as string]) } },
					relations: { user: true },
					take: 1
				} as never);
				const employee = items[0] as { id?: ID; userId?: ID | null } | undefined;
				context.authorsByEmail.set(key, employee?.id ? { employeeId: employee.id, userId: employee.userId ?? null } : null);
			} catch (caught) {
				this.logger.warn(`The employee of ${key} could not be looked up: ${this.describe(caught)}`);
				return null;
			}
		}
		return context.authorsByEmail.get(key) ?? null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
