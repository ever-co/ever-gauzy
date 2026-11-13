import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { AsanaApiClient, AsanaApiError, AsanaAttachment, AsanaStory, AsanaTask } from '../client/asana-api.client';
import { attachmentLinkOf, commentHtmlOf } from './asana-task.mapper';

/** The employee (and their user) a comment is attributed to, by the e-mail Asana gives for its author. */
export interface AsanaAuthor {
	employeeId: ID;
	userId: ID | null;
}

/** What a run hands the details import: its scope, how to read Asana, and the caches and tallies it keeps. */
export interface AsanaDetailsContext {
	scope: { tenantId: ID; organizationId: ID };
	integrationId: ID;
	/** The user who connected (the comments nobody here wrote are theirs to own). */
	connectedByUserId: ID | null;
	/** A read of Asana with the run's rate-limit waits and token renewal. */
	read<T>(make: (client: AsanaApiClient) => Promise<T>): Promise<T>;
	authorsByEmail: Map<string, AsanaAuthor | null>;
	/** What the details import brought in, and what it could not read or keep (a failure of the run: the position is kept). */
	details: { comments: number; links: number; failed: number };
}

/** A task's details as read from Asana, before anything is written. */
export interface AsanaTaskDetails {
	stories: AsanaStory[];
	attachments: AsanaAttachment[];
}

/**
 * A task's comments and attachments, brought in behind the task itself: every comment of the task (its stories of
 * subtype `comment_added`) becomes a comment of the platform task once — attributed to the employee whose user has
 * the author's e-mail, else kept as the connecting user's, marked `System`, and named after its author in the text —
 * and updated when it was edited in Asana; every attachment becomes a resource link of the task once (its name,
 * the address that opens it), reusing a link a person already added with the same address. Both are kept by the
 * platform's id map (entities `Comment` and `Attachment`), so a task read again adds nothing twice. Written
 * through the entities' repositories, as the platform's other integration does: the comment API states the
 * author as its caller, which here is the sync, not the person who wrote in Asana.
 *
 * The reads ({@link collect}) and the writes ({@link apply}) are apart: the caller reads with no lock held and
 * writes one run at a time per task, so two runs that meet on one task (a webhook and an import) never both find
 * no mapped comment and keep it twice. A comment or attachment that could not be read or kept is reported and
 * counted as a failure of the run — the import position is then kept and the next import reads the task again;
 * a refusal of one resource (403, 404) is not counted, a retry changes nothing. A refused token stops the run.
 */
@Injectable()
export class AsanaTaskDetailsService {
	private readonly logger = new Logger(AsanaTaskDetailsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly integrationMapService: IntegrationMapService,
		private readonly employeeService: EmployeeService
	) {}

	/** Reads the task's comments and attachments (two calls); what could not be read is counted and left empty. */
	async collect(context: AsanaDetailsContext, task: AsanaTask): Promise<AsanaTaskDetails> {
		return {
			stories: await this.readPart(context, task, 'comments', (client) => client.stories(task.gid)),
			attachments: await this.readPart(context, task, 'attachments', (client) => client.attachments(task.gid))
		};
	}

	/** Keeps what was read, each once. */
	async apply(context: AsanaDetailsContext, task: AsanaTask, details: AsanaTaskDetails, taskId: ID): Promise<void> {
		for (const story of details.stories) {
			try {
				await this.applyStory(context, story, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Comment ${story.gid} of Asana task ${task.gid} could not be kept: ${this.describe(caught)}`);
			}
		}
		for (const attachment of details.attachments) {
			try {
				await this.applyAttachment(context, attachment, taskId);
			} catch (caught) {
				context.details.failed += 1;
				this.logger.warn(`Attachment ${attachment.gid} of Asana task ${task.gid} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	private async readPart<T>(context: AsanaDetailsContext, task: AsanaTask, what: string, make: (client: AsanaApiClient) => Promise<T[]>): Promise<T[]> {
		try {
			return await context.read(make);
		} catch (caught) {
			if (caught instanceof AsanaApiError && caught.isUnauthorized) throw caught;
			if (!(caught instanceof AsanaApiError && (caught.isForbidden || caught.isNotFound))) context.details.failed += 1;
			this.logger.warn(`The ${what} of Asana task ${task.gid} could not be read: ${this.describe(caught)}`);
			return [];
		}
	}

	private async applyStory(context: AsanaDetailsContext, story: AsanaStory, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const author = await this.authorOf(context, story.created_by?.email ?? null);
		const html = commentHtmlOf(story, !!author);
		if (!html) return;
		const comments = this.dataSource.getRepository(Comment);
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.COMMENT, sourceId: story.gid, integrationId, ...scope })
			.catch(() => null);
		if (existing?.gauzyId) {
			// Edited in Asana: the platform's copy follows, as it was attributed when it was kept (an author matched only
			// now does not lose the name line a System comment carries); the same words are left alone.
			const row = await comments.findOne({ where: { id: existing.gauzyId, tenantId: scope.tenantId } as never, select: { id: true, comment: true, employeeId: true } as never });
			if (!row) return;
			const stored = commentHtmlOf(story, !!row.employeeId);
			if (row.comment !== stored) {
				await comments.update({ id: existing.gauzyId } as never, { comment: stored, editedAt: new Date() } as never);
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
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: story.gid, entity: IntegrationEntity.COMMENT, ...scope })
		);
		context.details.comments += 1;
	}

	private async applyAttachment(context: AsanaDetailsContext, attachment: AsanaAttachment, taskId: ID): Promise<void> {
		const { scope, integrationId } = context;
		const link = attachmentLinkOf(attachment);
		if (!link) return;
		const links = this.dataSource.getRepository(ResourceLink);
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ATTACHMENT, sourceId: attachment.gid, integrationId, ...scope })
			.catch(() => null);
		if (existing?.gauzyId) {
			// Renamed in Asana: the link follows; a person's link reused below is never rewritten (it is not mapped).
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
			new IntegrationMapSyncEntityCommand({ gauzyId: saved.id as ID, integrationId, sourceId: attachment.gid, entity: IntegrationEntity.ATTACHMENT, ...scope })
		);
		context.details.links += 1;
	}

	/** The employee (and user) with the author's e-mail in the organization, once per e-mail per run; null when none (or no e-mail). */
	private async authorOf(context: AsanaDetailsContext, email: string | null): Promise<AsanaAuthor | null> {
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
