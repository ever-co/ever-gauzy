import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { JiraAttachment, JiraComment, JiraIssue } from '../client/jira-api.client';
import { attachmentLinkOf, commentHtmlOf } from './jira-issue.mapper';

/** The employee (and their user) a comment is attributed to, by the e-mail Jira gives for its author. */
export interface JiraAuthor {
	employeeId: ID;
	userId: ID | null;
}

/** What a run hands the details import: its scope and the caches and tallies it keeps. */
export interface JiraDetailsContext {
	scope: { tenantId: ID; organizationId: ID };
	integrationId: ID;
	/** The user who connected (the comments nobody here wrote are theirs to own). */
	connectedByUserId: ID | null;
	authorsByEmail: Map<string, JiraAuthor | null>;
	/** What the details import brought in, and what it could not keep (a failure of the run: the position is kept). */
	details: { comments: number; links: number; failed: number };
}

/**
 * An issue's comments and attachments, brought in behind the issue itself (they come with it; the sync reads the
 * comments a search left out before it hands the issue over).
 * Every comment becomes a comment of the platform task once — attributed to the employee whose user has the
 * author's e-mail, else kept as the connecting user's, marked `System`, and named after its author in the text —
 * (its ADF body as HTML), and follows an edit in Jira; every attachment becomes a
 * resource link of the task once (its title, the address that opens it), reusing a link a person already added
 * with the same address. Both are kept by the platform's id map (entities `Comment` and `Attachment`), so an issue
 * read again adds nothing twice. Written through the entities' repositories, as the platform's other integration
 * does: the comment API states the author as its caller, which here is the sync, not the person who wrote in Jira.
 *
 * Written one run at a time per issue by the caller (under the issue's lock), so two runs that meet on one issue
 * never both find no mapped comment and keep it twice. A comment or attachment that could not be kept is reported
 * and counted as a failure of the run: the import position is then kept and the next import reads the issue again.
 */
@Injectable()
export class JiraIssueDetailsService {
	private readonly logger = new Logger(JiraIssueDetailsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly integrationMapService: IntegrationMapService,
		private readonly employeeService: EmployeeService
	) {}

	/** The comments and attachments of one issue, each once. */
	async apply(context: JiraDetailsContext, issue: JiraIssue, taskId: ID): Promise<void> {
		for (const comment of issue.fields?.comment?.comments ?? []) {
			try {
				await this.applyComment(context, comment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Comment ${comment.id} of issue ${issue.key} could not be kept: ${this.describe(caught)}`);
			}
		}
		for (const attachment of issue.fields?.attachment ?? []) {
			try {
				await this.applyAttachment(context, attachment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Attachment ${attachment.id} of issue ${issue.key} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	private async applyComment(context: JiraDetailsContext, comment: JiraComment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const author = await this.authorOf(context, comment.author?.emailAddress ?? null);
		const html = commentHtmlOf(comment, !!author);
		if (!html) return;
		const comments = this.dataSource.getRepository(Comment);
		const existing = await this.mapOf(context, IntegrationEntity.COMMENT, String(comment.id));
		if (existing) {
			// Edited in Jira: the platform's copy follows, as it was attributed when it was kept (an author matched only
			// now does not lose the name line a System comment carries); the same words are left alone.
			const row = await comments.findOne({ where: { id: existing, tenantId: scope.tenantId } as never, select: { id: true, comment: true, employeeId: true } as never });
			if (!row) return;
			const stored = commentHtmlOf(comment, !!row.employeeId);
			if (row.comment !== stored) {
				await comments.update({ id: existing } as never, { comment: stored, editedAt: new Date() } as never);
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
		await this.mapOrUndo(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: String(comment.id), entity: IntegrationEntity.COMMENT, ...scope }),
			() => comments.delete({ id: saved.id } as never)
		);
		context.details.comments += 1;
	}

	private async applyAttachment(context: JiraDetailsContext, attachment: JiraAttachment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const link = attachmentLinkOf(attachment);
		if (!link) return;
		const links = this.dataSource.getRepository(ResourceLink);
		const existing = await this.mapOf(context, IntegrationEntity.ATTACHMENT, String(attachment.id));
		if (existing) {
			// Retitled in Jira: the link follows; a person's link reused below is never rewritten (it is not mapped).
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
		await this.mapOrUndo(
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: String(attachment.id), entity: IntegrationEntity.ATTACHMENT, ...scope }),
			() => links.delete({ id: saved.id } as never)
		);
		context.details.links += 1;
	}

	/** The platform id a Jira record was kept as, or null. */
	/**
	 * The record a Jira comment or attachment is kept as, or null when it is not kept yet. Only a miss is "not kept": a
	 * lookup that failed (a timeout, a lost connection) fails this detail, or the record would be kept a second time.
	 */
	private async mapOf(context: JiraDetailsContext, entity: IntegrationEntity, sourceId: string): Promise<ID | null> {
		const map = await this.integrationMapService
			.findOneByWhereOptions({ entity, sourceId, integrationId: context.integrationId, ...context.scope })
			.catch((error: unknown) => {
				if (error instanceof NotFoundException) return null;
				throw error;
			});
		return (map?.gauzyId as ID | undefined) ?? null;
	}

	/**
	 * Records the id map of a record just kept; when that fails, the record goes again (best effort) and the failure
	 * stands, so the next read of the issue keeps it once, with its map, instead of a second unmapped copy.
	 */
	private async mapOrUndo(command: IntegrationMapSyncEntityCommand, undo: () => Promise<unknown>): Promise<void> {
		try {
			await this.commandBus.execute(command);
		} catch (error) {
			await undo().catch((caught: unknown) => this.logger.warn(`A record whose id map failed could not be removed again: ${this.describe(caught)}`));
			throw error;
		}
	}

	/** The employee (and user) with the author's e-mail in the organization, once per e-mail per run; null when none (or no e-mail). */
	private async authorOf(context: JiraDetailsContext, email: string | null): Promise<JiraAuthor | null> {
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
				// Not "nobody": the detail fails (and is read again by the next import), rather than being kept as a System
				// comment for good when the author is an employee.
				this.logger.warn(`The employee of ${key} could not be looked up: ${this.describe(caught)}`);
				throw caught;
			}
		}
		return context.authorsByEmail.get(key) ?? null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
