import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ActorTypeEnum, BaseEntityEnum, ID } from '@gauzy/contracts';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import type { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import type { EverWorksApplyOutcome } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import type { EverWorksOutboundHandler, EverWorksPushContext, EverWorksPushOutcome } from '../sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { escapeHtml, htmlToMarkdown, markdownToHtml, normaliseMarkdown } from './ever-works-markdown';
import { EverWorksRequestContextUnavailableError, EverWorksTaskActor, EverWorksTaskStore, TASK_IN_ANOTHER_ORGANIZATION } from './ever-works-task.store';

/** An Ever Works task chat message (contract v1 comment DTO; also the `data` of `task.comment.*`). */
export interface EverWorksComment {
	id: string;
	taskId: string;
	organizationId?: string;
	authorType: 'user' | 'agent' | 'integration';
	authorId: string;
	externalAuthor?: { name: string; avatarUrl?: string | null; source?: string } | null;
	body: string;
	editedAt?: string | null;
	createdAt?: string;
	updatedAt?: string;
	externalLinks?: Array<{ source: string; installationId?: string | null; externalId: string; externalUrl?: string | null }>;
	deleted?: boolean;
}

/**
 * A comment link's snapshot: each side's own full text (Markdown) at the last sync. The Gauzy side is the
 * whole Gauzy comment, even when Ever Works got it cut to its limit.
 */
interface CommentSnapshot {
	g?: { body?: string };
	e?: { body?: string };
}

/** What only Ever Works has about a linked comment (and what the sync must remember about it). */
interface CommentEverWorksOnly {
	taskId?: string;
	/** Ever Works' author: only they may edit or delete it (CR-2). */
	authorType?: string;
	authorId?: string;
	/** A Gauzy edit Ever Works refused (the author's 5-minute window, or not the author): not sent again. */
	refusedBody?: string | null;
}

/** Ever Works' task chat limit (contract v1, CR-2): a longer Gauzy comment is cut, with a note. */
export const EVER_WORKS_COMMENT_LIMIT = 16384;
const CUT_NOTE = '\n\n… (cut to fit Ever Works; the full comment is in Gauzy)';
/** A comment waiting for its task to be linked is retried after this long. */
export const COMMENT_WAIT_MS = 60_000;
/** How often the comment sweep (edits and deletes the ORM hooks cannot see) runs per connection. */
export const COMMENT_SWEEP_MS = 10 * 60_000;
const COMMENT_SWEEP_PAGE = 200;

const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';

/** A Gauzy comment's body for Ever Works: Markdown, at most {@link EVER_WORKS_COMMENT_LIMIT} characters. */
export function commentBodyForEverWorks(html: string | null | undefined): string {
	return cutForEverWorks(htmlToMarkdown(html));
}

function cutForEverWorks(body: string): string {
	if (body.length <= EVER_WORKS_COMMENT_LIMIT) return body;
	return body.slice(0, EVER_WORKS_COMMENT_LIMIT - CUT_NOTE.length).trimEnd() + CUT_NOTE;
}

/**
 * Task comments ↔ Ever Works task chat (plan 01 §7, §3), linked as `COMMENT`.
 *
 * - **EW → G** (`task.comment.created/updated/deleted`): a Gauzy comment on the linked task (Markdown →
 *   sanitised HTML), written as the author's employee — the agent employee for an agent (`ActorTypeEnum.Agent`),
 *   the mapped person for a user; an unmapped author is named in the comment. Comment events are applied by
 *   comment id (they carry the task's version, not their own), so a task read later never hides them.
 * - **G → EW** (the comment subscriber, and a sweep for what the ORM hooks miss): `POST /tasks/:id/comments`
 *   as the author (`X-Act-As-User` = the author's linked person), else as the integration with
 *   `externalAuthor`, with an `externalRef` and a deterministic `Idempotency-Key`; the body is cut to 16384
 *   characters (CR-2). Edits `PATCH`, deletes `DELETE`, both as Ever Works' author of the comment when that
 *   person made the change in Gauzy, else as the integration (review F21). Ever Works lets only the author edit,
 *   and a person only for 5 minutes (`422 domain_rule`): a refused Gauzy edit is logged, kept in Gauzy and not
 *   sent again (plan 01 §7).
 * - A comment of a task that is not linked yet waits for the task (which is queued).
 */
@Injectable()
export class EverWorksTaskCommentsService implements EverWorksOutboundHandler, EverWorksSyncSweeper {
	readonly entityTypes = [EverWorksLinkType.COMMENT] as const;
	readonly sweepIntervalMs = COMMENT_SWEEP_MS;
	private readonly logger = new Logger('EverWorksTaskComments');

	constructor(
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly queue: EverWorksOutboundQueue,
		private readonly store: EverWorksTaskStore,
		private readonly log: EverWorksSyncLogService
	) {}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** `task.comment.*` for a mapping (called by the task handler, which owns the `task` aggregate). */
	async apply(context: EverWorksMappingContext, envelope: EverWorksEventEnvelope): Promise<EverWorksApplyOutcome> {
		const comment = { ...(envelope.data as unknown as EverWorksComment) };
		if (!comment?.id) return { status: 'skipped', message: 'the comment event carries no comment' };
		const taskLink = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, envelope.aggregate.id);
		if (!taskLink || taskLink.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the task is not synced' };
		// A task moved to another organization takes no comment of this mapping (review F23).
		const taskOrganizationId = await this.store.organizationOfTask(context.tenantId, taskLink.gauzyId as ID);
		if (taskOrganizationId && taskOrganizationId !== context.organizationId) return { status: 'skipped', message: TASK_IN_ANOTHER_ORGANIZATION };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.COMMENT, comment.id);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the comment is no longer synced' };
		if (envelope.type === 'task.comment.deleted' || comment.deleted) {
			if (!link) return { status: 'skipped', message: 'the comment is not linked' };
			await this.store.softDeleteComment(link.gauzyId as ID);
			await this.links.unlink(link, 'deleted in Ever Works; the Gauzy comment is deleted (soft)');
			return { status: 'applied' };
		}
		// Comments have no version of their own: an older event (a late delivery) never overwrites a newer one.
		if (link?.ewUpdatedAt && comment.updatedAt && new Date(comment.updatedAt).getTime() < new Date(link.ewUpdatedAt).getTime()) {
			return { status: 'skipped', message: 'an older state of the comment than the one applied' };
		}
		const body = normaliseMarkdown(comment.body);
		if (!link) {
			// Our own comment whose link was not recorded (a lost answer): linked back, not copied — only when it
			// is a comment of this very task, in this organization, and not paired already.
			const own = (comment.externalLinks ?? []).find((row) => row.source === EVER_WORKS_LINK_SOURCE && (!row.installationId || row.installationId === context.connection.id));
			const mine = own?.externalId ? await this.store.loadComment(context.tenantId, own.externalId as ID) : null;
			if (
				mine &&
				!mine.deletedAt &&
				mine.entity === BaseEntityEnum.Task &&
				mine.entityId === taskLink.gauzyId &&
				mine.organizationId === context.organizationId &&
				!(await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.COMMENT, mine.id))
			) {
				await this.record(context, mine.id, comment, { g: { body: htmlToMarkdown(mine.comment) }, e: { body } }, 'inbound');
				return { status: 'applied', message: 'linked back to the Gauzy comment it came from' };
			}
			const author = await this.authorOf(context, comment);
			const html = this.htmlOf(body, author);
			const commentId = await this.store.asActor(context, author.actor, () =>
				this.store.addComment(context, taskLink.gauzyId as ID, html, author.actorType, author.actor.employeeId)
			);
			await this.record(context, commentId, comment, { g: { body: htmlToMarkdown(html) }, e: { body } }, 'inbound');
			return { status: 'applied' };
		}
		const snapshot = this.snapshotOf(link);
		if ((snapshot.e?.body ?? null) === body) return { status: 'skipped', message: 'the comment did not change' };
		const row = await this.store.loadComment(context.tenantId, link.gauzyId as ID);
		if (!row || row.deletedAt) return { status: 'skipped', message: 'the Gauzy comment is gone' };
		const current = htmlToMarkdown(row.comment);
		if (snapshot.g?.body !== undefined && current !== snapshot.g.body) {
			// Edited in Gauzy too: the Gauzy edit stays (it is pushed, or kept and logged when Ever Works refuses it).
			await this.record(context, link.gauzyId as ID, comment, { g: snapshot.g, e: { body } }, 'inbound', link);
			return { status: 'skipped', message: 'edited on both sides; the Gauzy edit is kept' };
		}
		const author = await this.authorOf(context, comment);
		const html = this.htmlOf(body, author);
		await this.store.updateComment(link.gauzyId as ID, html);
		await this.record(context, link.gauzyId as ID, comment, { g: { body: htmlToMarkdown(html) }, e: { body } }, 'inbound', link);
		return { status: 'applied' };
	}

	/** The Gauzy author of an Ever Works comment: a linked agent or person, else (named in the text) the admin who connected. */
	private async authorOf(context: EverWorksMappingContext, comment: EverWorksComment): Promise<{ actor: EverWorksTaskActor; actorType: ActorTypeEnum; named: string | null }> {
		const type = comment.authorType === 'agent' ? EverWorksLinkType.AGENT : comment.authorType === 'user' ? EverWorksLinkType.MEMBER : null;
		const link = type ? await this.links.byEw(context.integrationTenantId, type, comment.authorId) : null;
		if (link && link.state !== EverWorksLinkState.UNLINKED) {
			const user = await this.store.userOfEmployee(link.gauzyId as ID);
			return {
				actor: { userId: user.userId, name: user.name ?? 'Ever Works', agent: type === EverWorksLinkType.AGENT, employeeId: link.gauzyId as ID },
				actorType: type === EverWorksLinkType.AGENT ? ActorTypeEnum.Agent : ActorTypeEnum.User,
				named: null
			};
		}
		const named = comment.externalAuthor?.name || (comment.authorType === 'agent' ? 'An Ever Works agent' : comment.authorType === 'user' ? 'An Ever Works member' : 'Ever Works');
		return {
			actor: { userId: (context.connection.connectedByUserId as ID) ?? null, name: named, agent: comment.authorType === 'agent', employeeId: null },
			actorType: comment.authorType === 'agent' ? ActorTypeEnum.Agent : ActorTypeEnum.System,
			named
		};
	}

	/** The Gauzy HTML of a comment; an author Gauzy cannot attribute is named in front of the text. */
	private htmlOf(body: string, author: { named: string | null }): string {
		const html = markdownToHtml(body);
		return author.named ? `<p><strong>${escapeHtml(author.named)}</strong> (Ever Works):</p>${html}` : html;
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy comment on a task was written, edited or deleted. */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id) return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.tasks)) return { status: 'skipped', message: 'tasks are not pushed to Ever Works' };
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.COMMENT, change.gauzyId as ID);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the comment is no longer synced' };
		const row = await this.store.loadComment(context.tenantId, change.gauzyId as ID);
		try {
			// Who made the change being sent: the captured actor and the row's own audit column must both be the author
			// (a retried change keeps its first actor while the row may carry someone else's later edit or delete).
			if (change.op === 'delete' || !row || row.deletedAt) return await this.pushDelete(context, link, [change.actorUserId, row?.deletedByUserId]);
			if (row.entity !== BaseEntityEnum.Task || row.organizationId !== context.organizationId) return { status: 'skipped', message: 'not a comment of a task of this organization' };
			const taskOrganizationId = await this.store.organizationOfTask(context.tenantId, row.entityId as ID);
			if (taskOrganizationId && taskOrganizationId !== context.organizationId) return { status: 'skipped', message: TASK_IN_ANOTHER_ORGANIZATION };
			const taskLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, row.entityId as ID);
			if (!taskLink || taskLink.state === EverWorksLinkState.UNLINKED) {
				if (taskLink) return { status: 'skipped', message: 'the task is no longer synced' };
				// The comment waits for its task, which is queued (it goes first).
				await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: row.entityId as ID, op: 'upsert' });
				return { status: 'deferred', message: 'the task is not in Ever Works yet', retryInMs: COMMENT_WAIT_MS };
			}
			const full = htmlToMarkdown(row.comment);
			if (!full.trim()) return { status: 'skipped', message: 'the comment has no text' };
			const client = this.client(context);
			return link
				? await this.pushEdit(context, client, link, taskLink, full, [change.actorUserId, row.updatedByUserId])
				: await this.pushCreate(context, client, row, taskLink, full, row.createdByUserId ?? change.actorUserId ?? null);
		} catch (error) {
			if (error instanceof EverWorksRequestContextUnavailableError) return { status: 'deferred', message: error.message, retryInMs: 5 * 60_000 };
			throw error;
		}
	}

	private async pushCreate(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		row: { id?: ID; employeeId?: ID | null },
		taskLink: EverWorksEntityLink,
		full: string,
		writerUserId: ID | null
	): Promise<EverWorksPushOutcome> {
		const connectionId = context.connection.id as ID;
		const commentId = row.id as ID;
		// As the person who wrote it (the comment's creator), never as the employee the comment names: a caller with
		// no employee of their own may set any employeeId (review F21). Else the integration, with `externalAuthor`.
		const actAs = await this.everWorksUserOf(context, writerUserId);
		const idempotencyKey = createHash('sha256').update(`${connectionId}:${EverWorksLinkType.COMMENT}:${commentId}:create`).digest('hex');
		const name = row.employeeId ? ((await this.store.userOfEmployee(row.employeeId as ID)).name ?? 'Ever Gauzy') : 'Ever Gauzy';
		const path = `/tasks/${encodeURIComponent(taskLink.ewId)}/comments`;
		const send = (actor: string | null) =>
			client.request<EverWorksComment>('POST', path, {
				body: {
					body: cutForEverWorks(full),
					...(actor ? {} : { externalAuthor: { name, source: EVER_WORKS_LINK_SOURCE } }),
					externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: commentId }
				},
				idempotencyKey: actor === actAs ? idempotencyKey : createHash('sha256').update(`${idempotencyKey}:no-act-as`).digest('hex'),
				actAsUserId: actor
			});
		let created: EverWorksComment;
		try {
			created = await send(actAs);
		} catch (error) {
			if (!actAs || !(error instanceof EverWorksApiError && error.status === 403 && error.code === 'act_as_forbidden')) throw error;
			created = await send(null);
		}
		// The Gauzy side is the whole comment (Ever Works may have got it cut).
		await this.record(context, commentId, { ...created, taskId: taskLink.ewId }, { g: { body: full }, e: { body: normaliseMarkdown(created.body) } }, 'outbound');
		return { status: 'pushed', message: 'posted to the Ever Works task chat' };
	}

	private async pushEdit(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		link: EverWorksEntityLink,
		taskLink: EverWorksEntityLink,
		full: string,
		editorUserIds: ReadonlyArray<ID | null | undefined>
	): Promise<EverWorksPushOutcome> {
		const snapshot = this.snapshotOf(link);
		const ewOnly = this.everWorksOnly(link);
		if ((snapshot.g?.body ?? null) === full) return { status: 'skipped', message: 'nothing changed' };
		if ((ewOnly.refusedBody ?? null) === full) return { status: 'skipped', message: 'Ever Works refused this edit before; it stays in Gauzy' };
		const path = `/tasks/${encodeURIComponent(taskLink.ewId)}/comments/${encodeURIComponent(link.ewId)}`;
		try {
			// Only Ever Works' author of the comment may edit it: the person it was written as (only when that person made
			// the edit in Gauzy), or the integration — so anyone else's edit is refused by Ever Works (review F21).
			const updated = await client.request<EverWorksComment>('PATCH', path, {
				body: { body: cutForEverWorks(full) },
				actAsUserId: await this.actAsAuthor(context, ewOnly, editorUserIds)
			});
			await this.record(context, link.gauzyId as ID, { ...updated, taskId: taskLink.ewId }, { g: { body: full }, e: { body: normaliseMarkdown(updated.body) } }, 'outbound', link, null);
			return { status: 'pushed' };
		} catch (error) {
			if (!(error instanceof EverWorksApiError && (error.status === 422 || error.status === 403))) throw error;
			// Refused (not the author, or the 5-minute window passed): the Gauzy edit stays in Gauzy and is logged.
			// The snapshot keeps the last text both sides agreed on, so a later Ever Works edit still sees the Gauzy
			// edit as Gauzy's; the refused text is remembered so it is not sent again.
			await this.record(context, link.gauzyId as ID, null, snapshot, 'outbound', link, full);
			await this.logRefusal(context, link, 'comment_edit_refused', error.message);
			return { status: 'skipped', message: 'Ever Works keeps the comment as it was (edit refused); the Gauzy edit is logged' };
		}
	}

	/** A Gauzy comment deleted: deleted in Ever Works too (plan 03 §C.3), as its Ever Works author; a refusal is logged. */
	private async pushDelete(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		deletedByUserIds: ReadonlyArray<ID | null | undefined>
	): Promise<EverWorksPushOutcome> {
		if (!link) return { status: 'skipped', message: 'the comment is not in Ever Works' };
		const ewOnly = this.everWorksOnly(link);
		let refused: string | null = null;
		if (ewOnly.taskId) {
			try {
				await this.client(context).request('DELETE', `/tasks/${encodeURIComponent(ewOnly.taskId)}/comments/${encodeURIComponent(link.ewId)}`, {
					actAsUserId: await this.actAsAuthor(context, ewOnly, deletedByUserIds)
				});
			} catch (error) {
				if (!(error instanceof EverWorksApiError && (error.status === 404 || error.status === 422 || error.status === 403))) throw error;
				if (error.status !== 404) {
					refused = error.message;
					await this.logRefusal(context, link, 'comment_delete_refused', error.message);
				}
			}
		}
		await this.links.unlink(link, refused ? `deleted in Gauzy; Ever Works refused the delete (${refused.slice(0, 200)})` : 'deleted in Gauzy');
		return refused
			? { status: 'skipped', message: 'deleted in Gauzy; Ever Works refused the delete, so its copy stays (logged)' }
			: { status: 'pushed', message: 'deleted in Ever Works' };
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The comment sweep (plan 03 §C.2, the durable backstop): Gauzy deletes comments by criteria and edits them
	 * with partial saves, which the ORM hooks see incompletely or not at all. A linked comment that is gone, or
	 * whose text differs from its snapshot (and is not an edit Ever Works refused), is queued.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contexts.forConnection(connection)) {
			if (!context.isEnabled || !toEverWorks(context.directions.tasks)) continue;
			const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.COMMENT)).filter((link) => link.state === EverWorksLinkState.OK);
			for (let start = 0; start < links.length; start += COMMENT_SWEEP_PAGE) {
				for (const link of links.slice(start, start + COMMENT_SWEEP_PAGE)) {
					const row = await this.store.loadComment(context.tenantId, link.gauzyId as ID);
					const gone = !row || !!row.deletedAt;
					const text = row ? htmlToMarkdown(row.comment) : null;
					const edited = !gone && text !== (this.snapshotOf(link).g?.body ?? null) && text !== (this.everWorksOnly(link).refusedBody ?? null);
					if (gone || edited) {
						await this.queue.enqueue({
							tenantId: context.tenantId,
							organizationId: context.organizationId,
							entityType: EverWorksLinkType.COMMENT,
							gauzyId: link.gauzyId as ID,
							op: gone ? 'delete' : 'upsert'
						});
					}
				}
			}
		}
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	/** The Ever Works user a Gauzy author writes as, or `null` (the integration writes, with `externalAuthor`). */
	private async actAsFor(context: EverWorksMappingContext, employeeId: ID | null): Promise<string | null> {
		if (!employeeId) return null;
		const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId);
		return person && person.state !== EverWorksLinkState.UNLINKED ? person.ewId : null;
	}

	/** Who may edit or delete a linked comment in Ever Works: the person it was written as, else the integration. */
	private everWorksAuthor(ewOnly: CommentEverWorksOnly): string | null {
		return ewOnly.authorType === 'user' && ewOnly.authorId ? ewOnly.authorId : null;
	}

	/** The Ever Works person a Gauzy user writes as (their employee in the organization, paired as a member), or `null`. */
	private async everWorksUserOf(context: EverWorksMappingContext, userId: ID | null | undefined): Promise<string | null> {
		if (!userId) return null;
		return this.actAsFor(context, await this.store.employeeOfUser(context.tenantId, context.organizationId, userId));
	}

	/**
	 * Who an edit or delete of a linked comment goes as (review F21): its Ever Works author only when every known actor
	 * of the change (the captured actor, the row's updatedBy / deletedBy user) is that same person; anyone else (a
	 * manager editing any comment, the admin who owns an unmapped author's copy, no known actor) goes as the
	 * integration, which Ever Works refuses for a person's message (logged).
	 */
	private async actAsAuthor(
		context: EverWorksMappingContext,
		ewOnly: CommentEverWorksOnly,
		actorUserIds: ReadonlyArray<ID | null | undefined>
	): Promise<string | null> {
		const author = this.everWorksAuthor(ewOnly);
		const actors = [...new Set(actorUserIds.filter((id): id is ID => !!id))];
		if (!author || !actors.length) return null;
		for (const actor of actors) if ((await this.everWorksUserOf(context, actor)) !== author) return null;
		return author;
	}

	private async record(
		context: EverWorksMappingContext,
		commentId: ID,
		comment: EverWorksComment | null,
		snapshot: CommentSnapshot,
		direction: 'inbound' | 'outbound',
		previous?: EverWorksEntityLink,
		refusedBody?: string | null
	): Promise<void> {
		const before = this.everWorksOnly(previous ?? null);
		const ewOnly: CommentEverWorksOnly = {
			...before,
			...(comment ? { taskId: comment.taskId, authorType: comment.authorType, authorId: comment.authorId } : {}),
			...(refusedBody !== undefined ? { refusedBody } : {})
		};
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.COMMENT,
			gauzyId: commentId,
			ewId: comment?.id ?? (previous?.ewId as string),
			...(comment?.updatedAt ? { ewUpdatedAt: comment.updatedAt } : {}),
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private snapshotOf(link: EverWorksEntityLink): CommentSnapshot {
		return this.links.snapshot<CommentSnapshot>(link) as CommentSnapshot;
	}

	private everWorksOnly(link: EverWorksEntityLink | null | undefined): CommentEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as CommentEverWorksOnly;
		} catch {
			return {};
		}
	}

	private async logRefusal(context: EverWorksMappingContext, link: EverWorksEntityLink, action: string, message: string): Promise<void> {
		await this.log
			.write({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'outbound',
				entityType: EverWorksLinkType.COMMENT,
				gauzyId: link.gauzyId as ID,
				ewId: link.ewId,
				action,
				status: 'conflict',
				message
			})
			.catch(() => undefined);
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}
