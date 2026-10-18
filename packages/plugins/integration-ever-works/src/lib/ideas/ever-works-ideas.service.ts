import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID } from '@gauzy/contracts';
import {
	Comment,
	IntegrationSetting,
	OrganizationProject,
	OrganizationProjectCreateCommand,
	ResourceLink,
	Tag,
	Task,
	TaskCreateCommand,
	TaskStatus,
	TaskUpdateCommand
} from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import {
	EVER_WORKS_IDEA_ISSUE_TYPE,
	EVER_WORKS_IDEAS_PROJECT_NAME,
	EverWorksDirection
} from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import {
	EverWorksNoRequestContextError,
	everWorksUserOfGauzyUser,
	gauzyUserOfActor,
	NO_REQUEST_CONTEXT_RETRY_MS,
	runAsGauzyUser
} from '../sync/ever-works-actor';
import {
	EverWorksEntityLink,
	EverWorksLinkState,
	EverWorksLinkType,
	EverWorksOutboundChange
} from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { stableUuid } from '../sync/ever-works-stable-id';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import {
	EverWorksApplyContext,
	EverWorksApplyOutcome,
	EverWorksInboundApplier,
	EverWorksInboundHandler
} from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { resolveGauzyStatusRow } from '../sync/mappers/status-priority.mapper';
import {
	EverWorksOutboundHandler,
	EverWorksOutboundPusher,
	EverWorksPushContext,
	EverWorksPushOutcome
} from '../sync/outbound/ever-works-outbound.pusher';
import { gauzyTeamsFor, isSyncedVisibility, teamScopeFor } from '../teams/ever-works-team-scope';
import {
	EverWorksIdea,
	everWorksIdeaShared,
	gauzyTaskOfIdea,
	gauzyTaskToIdea,
	GAUZY_IDEA_ISSUE_TYPE,
	ideaCreateBody,
	ideaPatchBody,
	ideaSourceTag,
	ideaStatusAction,
	ideaStatusAsTaskStatus,
	ideaTextToHtml,
	IdeaSharedFields,
	isIdeaTask,
	sameSet
} from './ever-works-idea.mapper';

/** The shared fields of an idea pair at the last sync, in Ever Works' terms (the merge base of both directions). */
interface IdeaSnapshot extends IdeaSharedFields {
	status?: string | null;
}

/** What only Ever Works has, kept on the link (fields one side lacks are preserved, never nulled). */
interface IdeaEverWorksOnly {
	owner?: EverWorksIdea['owner'];
	source?: string | null;
	missionId?: string | null;
	targetWorkId?: string | null;
	acceptedWorkId?: string | null;
	failureMessage?: string | null;
	webUrl?: string | null;
	visibility?: string | null;
	/** Ever Works teams Gauzy could not map at the last sync; tried again on the next change. */
	unmappedTeams?: string[];
}

const fromEverWorks = (direction: EverWorksDirection | undefined) =>
	direction === 'both' || direction === 'ew_to_gauzy';
const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';

/**
 * Ideas ↔ Idea tasks (plan 01 §8, plan 06 G-P2-3), linked as `IDEA_TASK`. An Ever Works idea is a
 * Gauzy task of the organization's "Idea" issue type, in the "Ever Works — Ideas" project.
 *
 * - **EW → G** (`idea.*`): the idea's title, description (plain text, escaped), status (pending → open,
 *   queued / building → in progress, accepted → done, dismissed → cancelled, failed → blocked with the
 *   failure posted as a comment), teams (its scope, D11) and a `source:<value>` tag. Only what changed
 *   in Ever Works since the last sync is written. An idea created from a Gauzy task links back to that
 *   task. A deleted idea archives the task; a private one stops syncing (the task is kept).
 * - **G → EW**: a task of the Idea type becomes an Ever Works idea (`POST /ideas`: always `external` +
 *   `pending`); title, description and teams are patched; cancelling it dismisses the idea and
 *   reopening restores it. **Accepting and building stay in Ever Works** (spend safety, D9): no other
 *   status move is pushed. A task whose type changes away from Idea is unlinked (both records kept).
 * - Mission, target and accepted works stay on the link.
 */
@Injectable()
export class EverWorksIdeasService implements EverWorksInboundHandler, EverWorksOutboundHandler, OnModuleInit {
	readonly aggregateTypes = ['idea'] as const;
	readonly entityTypes = [EverWorksLinkType.IDEA_TASK] as const;
	private readonly logger = new Logger('EverWorksIdeas');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly commandBus: CommandBus,
		private readonly log: EverWorksSyncLogService,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher
	) {}

	/** Registers itself with the applier (`idea.*`) and the pusher (`IDEA_TASK`). */
	onModuleInit(): void {
		this.applier.register(this);
		this.pusher.register(this);
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `idea.created/updated/status_changed/deleted/visibility_changed`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.ideas))
			return { status: 'skipped', message: 'ideas are not synced from Ever Works' };
		const link = await this.links.byEw(
			context.integrationTenantId,
			EverWorksLinkType.IDEA_TASK,
			envelope.aggregate.id
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the idea is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion)
			return { status: 'skipped', message: 'already applied (version)' };
		const idea = { ...((envelope.data ?? {}) as unknown as EverWorksIdea), id: envelope.aggregate.id };
		if (envelope.type === 'idea.deleted') return this.archive(context, link);
		// Private ideas never sync (01 §2a rule 5): one that turned private stops syncing; the task is kept.
		if (!isSyncedVisibility(idea.visibility)) {
			if (!link) return { status: 'skipped', message: 'the idea is private in Ever Works' };
			await this.links.unlink(link, 'private in Ever Works; no longer shared from Ever Works');
			return { status: 'applied', message: 'the idea turned private; it is no longer synced' };
		}
		if (
			!['idea.created', 'idea.updated', 'idea.status_changed', 'idea.visibility_changed'].includes(envelope.type)
		) {
			return { status: 'skipped', message: `${envelope.type} is not synced` };
		}
		const actorUserId = await gauzyUserOfActor(this.dataSource, this.links, context, envelope.actor);
		if (!link && idea.title === undefined) {
			// A first event without the idea's content (an id-only visibility notice): read the idea itself.
			try {
				Object.assign(
					idea,
					await this.client(context).request<EverWorksIdea>('GET', `/ideas/${encodeURIComponent(idea.id)}`),
					{ id: idea.id }
				);
			} catch (error) {
				if (error instanceof EverWorksApiError && error.status === 404)
					return { status: 'skipped', message: 'the idea is not visible in Ever Works' };
				throw error;
			}
			if (!isSyncedVisibility(idea.visibility))
				return { status: 'skipped', message: 'the idea is private in Ever Works' };
		}
		try {
			return await this.applyIdea(context, link, idea, version, actorUserId);
		} catch (error) {
			// The worker cannot write through Gauzy's task commands: an API process applies it.
			if (error instanceof EverWorksNoRequestContextError)
				return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
	}

	private async applyIdea(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		idea: EverWorksIdea,
		version: number | null,
		actorUserId: ID | null,
		keepGauzy: ReadonlySet<'title' | 'description' | 'teams' | 'status'> = new Set()
	): Promise<EverWorksApplyOutcome> {
		const before = this.links.snapshot<IdeaSnapshot>(link);
		const ew = this.ewOnlyOf(link);
		const next = everWorksIdeaShared(idea, before);
		const status = idea.status ?? before.status ?? null;
		const teamMap = await this.teamMap(context);
		if (!link) {
			// An idea made from a Gauzy task (its own create echoed, or a lost answer) links back to that task.
			const madeFrom = gauzyTaskOfIdea(idea, context.connection.id as ID);
			if (madeFrom && (await this.task(context, madeFrom))) {
				await this.record(
					context,
					madeFrom,
					idea,
					version,
					{ ...next, status },
					null,
					gauzyTeamsFor(next.teamIds, teamMap).unmapped,
					'inbound'
				);
				return { status: 'applied', message: 'linked to the Gauzy task it was created from' };
			}
			return this.createTask(context, idea, next, status, version, actorUserId, teamMap);
		}
		const taskId = link.gauzyId as ID;
		const task = await this.task(context, taskId);
		if (!task) return { status: 'skipped', message: 'the Gauzy task is gone' };
		// `keepGauzy`: fields Gauzy changed after the last sync and is pushing now — its edit is the later one
		// (a 412 retry), so Ever Works' older value is not written over it; the snapshot still moves to Ever
		// Works' value, so the retry pushes Gauzy's.
		const changes: Record<string, unknown> = {};
		if (next.title && next.title !== before.title && !keepGauzy.has('title')) changes['title'] = next.title;
		if (next.description !== (before.description ?? '') && !keepGauzy.has('description'))
			changes['description'] = ideaTextToHtml(next.description);
		if (status && status !== (before.status ?? null) && !keepGauzy.has('status'))
			Object.assign(changes, await this.statusChanges(context, task.projectId as ID, status));
		if (Object.keys(changes).length) {
			await runAsGauzyUser(context, actorUserId, () =>
				this.commandBus.execute(new TaskUpdateCommand(taskId, changes as never, true))
			);
		}
		const unmapped = keepGauzy.has('teams')
			? gauzyTeamsFor(next.teamIds, teamMap).unmapped
			: await this.applyTeams(
					context,
					taskId,
					before.teamIds ?? [],
					next.teamIds,
					ew.unmappedTeams ?? [],
					teamMap
				);
		if ((idea.source ?? null) !== (ew.source ?? null)) await this.tagSource(context, taskId, idea.source);
		if (status === 'failed' && idea.failureMessage && idea.failureMessage !== ew.failureMessage)
			await this.comment(context, taskId, idea.failureMessage);
		await this.record(context, taskId, idea, version, { ...next, status }, link, unmapped, 'inbound');
		return { status: 'applied' };
	}

	/** Creates the Gauzy idea task of an Ever Works idea in the Ideas project, and links them. */
	private async createTask(
		context: EverWorksMappingContext,
		idea: EverWorksIdea,
		next: IdeaSharedFields,
		status: string | null,
		version: number | null,
		actorUserId: ID | null,
		teamMap: Map<string, ID>
	): Promise<EverWorksApplyOutcome> {
		const ideaTypeId = this.setting(context, EverWorksSettingName.IDEA_ISSUE_TYPE_ID);
		const projectId = await this.ideasProject(context, actorUserId);
		const teams = gauzyTeamsFor(next.teamIds, teamMap);
		const tagId = await this.sourceTagId(context, idea.source);
		const statusFields = status ? await this.statusChanges(context, projectId, status) : {};
		// A stable id (the goals' pattern): a retry after a failure half-way — the task written, its link not —
		// finds the task it wrote instead of creating a second one. `TaskCreateCommand` keeps a caller-supplied
		// id (the CRUD create inserts it; a row of another tenant with it is refused). A task deleted in Gauzy
		// under that id is not revived: a new one is created with an id of its own, as before.
		const seed = `${context.integrationTenantId}:idea-task:${idea.id}`;
		const stableId = stableUuid(seed) as ID;
		const written = await this.task(context, stableId, true);
		const reuse = !!written && !(written as { deletedAt?: Date | null }).deletedAt;
		const created = reuse
			? null
			: ((await runAsGauzyUser(context, actorUserId, () =>
					this.commandBus.execute(
						new TaskCreateCommand(
							{
								...(written ? {} : { id: stableId }),
								title: next.title || 'Idea',
								description: ideaTextToHtml(next.description),
								issueType: GAUZY_IDEA_ISSUE_TYPE,
								...(ideaTypeId ? { taskTypeId: ideaTypeId } : {}),
								projectId,
								...statusFields,
								teams: teams.teamIds.map((id) => ({ id })),
								tags: tagId ? [{ id: tagId }] : [],
								tenantId: context.tenantId,
								organizationId: context.organizationId
							} as never,
							true
						)
					)
				)) as Task);
		const taskId = ((created?.id as ID | undefined) ?? stableId) as ID;
		if (reuse)
			await this.catchUp(context, written as Task, next, statusFields, teams.teamIds, idea.source, actorUserId);
		// The resource link and the failure comment take stable ids too, so the retry does not add them twice.
		if (idea.webUrl)
			await this.resourceLink(
				context,
				taskId,
				'Ever Works idea',
				idea.webUrl,
				stableUuid(`${seed}:${taskId}:web-url`) as ID
			);
		if (status === 'failed' && idea.failureMessage)
			await this.comment(context, taskId, idea.failureMessage, stableUuid(`${seed}:${taskId}:failure`) as ID);
		await this.record(context, taskId, idea, version, { ...next, status }, null, teams.unmapped, 'inbound');
		this.logger.log(
			`Ever Works idea ${idea.id} created as Gauzy task ${taskId} (organization ${context.organizationId}).`
		);
		return { status: 'applied' };
	}

	/**
	 * The task a failed attempt created, found again by its stable id: Ever Works' current fields are written over
	 * it before its link records them (the idea may have changed between the attempts — a refetch, a newer
	 * event), as the update of a linked idea would. Only what differs is written; nothing is created or renumbered.
	 */
	private async catchUp(
		context: EverWorksMappingContext,
		task: Task,
		next: IdeaSharedFields,
		statusFields: Record<string, unknown>,
		teamIds: ID[],
		source: string | null | undefined,
		actorUserId: ID | null
	): Promise<void> {
		const taskId = task.id as ID;
		const wanted: Record<string, unknown> = {
			title: next.title || 'Idea',
			description: ideaTextToHtml(next.description),
			...statusFields
		};
		const row = task as unknown as Record<string, unknown>;
		const changes = Object.fromEntries(
			Object.entries(wanted).filter(([key, value]) => (row[key] ?? null) !== (value ?? null))
		);
		if (Object.keys(changes).length) {
			await runAsGauzyUser(context, actorUserId, () =>
				this.commandBus.execute(new TaskUpdateCommand(taskId, changes as never, true))
			);
		}
		const relation = this.dataSource.createQueryBuilder().relation(Task, 'teams').of(taskId);
		const current = ((await relation.loadMany()) as Array<{ id: ID }>).map((team) => team.id);
		const toAdd = teamIds.filter((id) => !current.includes(id));
		const toRemove = current.filter((id) => !teamIds.includes(id));
		if (toAdd.length || toRemove.length) await relation.addAndRemove(toAdd, toRemove);
		await this.tagSource(context, taskId, source);
	}

	/** A deleted idea archives its task (delete policy: nothing is hard-deleted) and stops syncing. */
	private async archive(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null
	): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the idea is not linked' };
		await this.dataSource
			.getRepository(Task)
			.update(
				{ id: link.gauzyId, tenantId: context.tenantId } as never,
				{ isArchived: true, archivedAt: new Date() } as never
			);
		await this.links.unlink(link, 'deleted in Ever Works; the Gauzy task is archived');
		return { status: 'applied' };
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy task of the Idea type changed (or a linked idea task stopped being one). */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id)
			return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.ideas))
			return { status: 'skipped', message: 'ideas are not pushed to Ever Works' };
		const link = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.IDEA_TASK,
			change.gauzyId as ID
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the idea is no longer synced' };
		const task = await this.task(context, change.gauzyId as ID, true);
		const client = this.client(context);
		const gone =
			change.op === 'delete' || !task || !!(task as { deletedAt?: Date | null }).deletedAt || !!task.isArchived;
		if (gone) {
			// Delete policy (archive / cancel): a pending idea is dismissed; nothing is deleted in Ever Works.
			if (!link) return { status: 'skipped', message: 'not linked' };
			if (this.links.snapshot<IdeaSnapshot>(link).status !== 'pending')
				return { status: 'skipped', message: 'only a pending idea is dismissed when its task goes' };
			await this.move(context, client, link, 'dismiss');
			return { status: 'pushed', message: 'the task was removed; the idea is dismissed' };
		}
		if (!isIdeaTask(task, this.setting(context, EverWorksSettingName.IDEA_ISSUE_TYPE_ID))) {
			if (!link) return { status: 'skipped', message: 'not an idea' };
			// 01 §8: changing the type away from Idea unlinks it, with a warning; neither side is deleted.
			await this.links.unlink(link, 'the Gauzy task is no longer an Idea; the Ever Works idea is kept');
			await this.log.write({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'outbound',
				entityType: EverWorksLinkType.IDEA_TASK,
				gauzyId: task.id as ID,
				ewId: link.ewId,
				action: 'unlinked',
				status: 'skipped',
				message:
					'The task is no longer of the Idea type, so it no longer syncs with its Ever Works idea (both are kept).'
			});
			return { status: 'skipped', message: 'no longer an idea: unlinked' };
		}
		const teams = ((task as { teams?: Array<{ id: ID }> }).teams ?? []).map((team) => team.id);
		const scope = teamScopeFor(
			teams,
			new Map([...(await this.teamMap(context)).entries()].map(([ewId, gauzyId]) => [gauzyId, ewId]))
		);
		if (!scope.scope)
			return {
				status: 'deferred',
				message: `waiting for the Gauzy team ${scope.waitingFor} to be paired (teams first)`
			};
		const now = gauzyTaskToIdea(task, scope.scope, this.ewOnlyOf(link).unmappedTeams ?? []);
		try {
			if (!link) return await this.create(context, client, task, now, change.actorUserId as ID | null);
			return await this.update(context, client, task, now, link);
		} catch (error) {
			// A Gauzy write of this push (a refused move written back) needs a request context: an API process pushes it.
			if (error instanceof EverWorksNoRequestContextError)
				return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
	}

	private async create(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		task: Task,
		now: ReturnType<typeof gauzyTaskToIdea>,
		actorUserId: ID | null
	): Promise<EverWorksPushOutcome> {
		const connectionId = context.connection.id as ID;
		const body = ideaCreateBody(now, connectionId, task.id as ID);
		const actAs = await everWorksUserOfGauzyUser(
			this.dataSource,
			this.links,
			context,
			actorUserId ?? (task as { createdByUserId?: ID }).createdByUserId ?? null
		);
		const key = (actor: string) =>
			createHash('sha256')
				.update(
					`${connectionId}:${EverWorksLinkType.IDEA_TASK}:${task.id}:create:${actor}:${JSON.stringify(body)}`
				)
				.digest('hex');
		let created: EverWorksIdea;
		try {
			created = await client.request<EverWorksIdea>('POST', '/ideas', {
				body,
				idempotencyKey: key('user'),
				actAsUserId: actAs
			});
		} catch (error) {
			if (!(
				actAs &&
				error instanceof EverWorksApiError &&
				error.status === 403 &&
				error.code === 'act_as_forbidden'
			))
				throw error;
			created = await client.request<EverWorksIdea>('POST', '/ideas', {
				body,
				idempotencyKey: key('integration')
			});
		}
		// A repeat of the same externalRef answers the existing idea: never re-pair one another task holds.
		const holder = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.IDEA_TASK, created.id);
		if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== task.id) {
			return { status: 'skipped', message: `the Ever Works idea ${created.id} is paired with another task` };
		}
		// The snapshot is what was sent (the agreed value), so the next Gauzy change is diffed against it.
		const snapshot: IdeaSnapshot = {
			title: now.title,
			description: now.description,
			teamIds: now.teamIds,
			status: created.status ?? 'pending'
		};
		let link = await this.record(
			context,
			task.id as ID,
			created,
			created.version ?? null,
			snapshot,
			null,
			[],
			'outbound'
		);
		this.logger.log(`Gauzy idea task ${task.id} created in Ever Works as idea ${created.id}.`);
		// An idea task created cancelled is dismissed at once (the only status move Gauzy makes).
		if (ideaStatusAction(snapshot.status, task.status, this.flagsOf(task)) === 'dismiss')
			link = (await this.move(context, client, link, 'dismiss')) ?? link;
		return { status: 'pushed', message: 'created in Ever Works' };
	}

	private async update(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		task: Task,
		now: ReturnType<typeof gauzyTaskToIdea>,
		link: EverWorksEntityLink
	): Promise<EverWorksPushOutcome> {
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const before = this.links.snapshot<IdeaSnapshot>(pair);
			const patch = ideaPatchBody(now, before);
			const action = ideaStatusAction(before.status, task.status, this.flagsOf(task));
			if (!patch && !action) return { status: 'skipped', message: 'nothing changed' };
			const ew = this.ewOnlyOf(pair);
			try {
				let current: EverWorksIdea | null = null;
				if (patch) {
					current = await client.request<EverWorksIdea>('PATCH', `/ideas/${encodeURIComponent(pair.ewId)}`, {
						body: patch,
						ifMatchVersion: pair.ewVersion ?? undefined,
						actAsUserId: this.ownerOf(ew)
					});
					pair = await this.record(
						context,
						task.id as ID,
						current,
						current.version ?? null,
						{
							title: now.title,
							description: now.description,
							teamIds: now.teamIds,
							status: current.status ?? before.status ?? null
						},
						pair,
						ew.unmappedTeams ?? [],
						'outbound'
					);
				}
				if (action) pair = (await this.move(context, client, pair, action, task)) ?? pair;
				return { status: 'pushed' };
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				// 412: Ever Works moved on. Its newer state is applied first when ideas sync from Ever Works (as
				// the sync, so it is not captured back), then this push is merged again on top of it.
				const remote = await client.request<EverWorksIdea>('GET', `/ideas/${encodeURIComponent(pair.ewId)}`);
				// What Gauzy changed since the last sync is the later edit: Ever Works' value is not written over it.
				const keep = new Set<'title' | 'description' | 'teams' | 'status'>();
				if (now.title !== before.title) keep.add('title');
				if (now.description !== before.description) keep.add('description');
				if (!sameSet(now.teamIds, before.teamIds ?? [])) keep.add('teams');
				if (action) keep.add('status');
				if (fromEverWorks(context.directions.ideas)) {
					await EverWorksSyncContext.run(
						{ connectionId: context.connection.id as ID, eventId: `idea-412:${pair.ewId}` },
						() =>
							this.applyIdea(
								context,
								pair,
								{ ...remote, id: pair.ewId },
								remote.version ?? null,
								(context.connection.connectedByUserId as ID) ?? null,
								keep
							)
					);
				} else {
					await this.record(
						context,
						task.id as ID,
						remote,
						remote.version ?? null,
						before as IdeaSnapshot,
						pair,
						ew.unmappedTeams ?? [],
						'outbound'
					);
				}
				const fresh = await this.links.byGauzy(
					context.integrationTenantId,
					EverWorksLinkType.IDEA_TASK,
					task.id as ID
				);
				const freshTask = await this.task(context, task.id as ID, true);
				if (!fresh || !freshTask) return { status: 'skipped', message: 'the idea changed during the push' };
				pair = fresh;
				task = freshTask;
				const teams = ((freshTask as { teams?: Array<{ id: ID }> }).teams ?? []).map((team) => team.id);
				const scope = teamScopeFor(
					teams,
					new Map([...(await this.teamMap(context)).entries()].map(([ewId, gauzyId]) => [gauzyId, ewId]))
				);
				if (!scope.scope)
					return {
						status: 'deferred',
						message: `waiting for the Gauzy team ${scope.waitingFor} to be paired (teams first)`
					};
				now = gauzyTaskToIdea(freshTask, scope.scope, this.ewOnlyOf(fresh).unmappedTeams ?? []);
			}
		}
		throw new Error('unreachable');
	}

	/**
	 * Dismisses or restores the idea. Ever Works refuses a move its status does not allow (only a pending
	 * idea is dismissed, only a dismissed one restored): then its status is written back to the task (as
	 * the sync) and the refusal logged, the way a blocked task transition is (plan 03 §C.3).
	 */
	private async move(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		link: EverWorksEntityLink,
		action: 'dismiss' | 'restore',
		task?: Task
	): Promise<EverWorksEntityLink | null> {
		const ew = this.ewOnlyOf(link);
		const before = this.links.snapshot<IdeaSnapshot>(link);
		try {
			const moved = await client.request<EverWorksIdea>(
				'POST',
				`/ideas/${encodeURIComponent(link.ewId)}/${action}`,
				{ actAsUserId: this.ownerOf(ew) }
			);
			const jumped = moved.version != null && (link.ewVersion == null || moved.version !== link.ewVersion + 1);
			if (jumped && fromEverWorks(context.directions.ideas)) {
				// Ever Works changed the idea in between (its version moved by more than this move): its answer is the
				// idea as it is now, applied first (the status Gauzy just moved stays), as a 412 merge does. Recording
				// its version alone would skip that change as applied (review F86).
				await EverWorksSyncContext.run(
					{ connectionId: context.connection.id as ID, eventId: `idea-${action}:${link.ewId}` },
					() =>
						this.applyIdea(
							context,
							link,
							{ ...moved, id: link.ewId },
							moved.version ?? null,
							(context.connection.connectedByUserId as ID) ?? null,
							new Set(['status'] as const)
						)
				);
				return this.links.byEw(context.integrationTenantId, EverWorksLinkType.IDEA_TASK, link.ewId);
			}
			return this.record(
				context,
				link.gauzyId as ID,
				moved,
				moved.version ?? null,
				{ ...(before as IdeaSnapshot), status: moved.status ?? before.status ?? null },
				link,
				ew.unmappedTeams ?? [],
				'outbound'
			);
		} catch (error) {
			if (!(error instanceof EverWorksApiError && error.status === 422)) throw error;
			const kept = String((error.details?.['status'] as string | undefined) ?? before.status ?? '');
			if (task && kept) {
				const changes = await this.statusChanges(context, task.projectId as ID, kept);
				if (Object.keys(changes).length) {
					await EverWorksSyncContext.run(
						{ connectionId: context.connection.id as ID, eventId: `idea-${action}:${link.ewId}` },
						() =>
							runAsGauzyUser(context, (context.connection.connectedByUserId as ID) ?? null, () =>
								this.commandBus.execute(new TaskUpdateCommand(task.id as ID, changes as never, true))
							)
					);
				}
			}
			await this.log.write({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'outbound',
				entityType: EverWorksLinkType.IDEA_TASK,
				gauzyId: link.gauzyId as ID,
				ewId: link.ewId,
				action: `${action}_refused`,
				status: 'conflict',
				message: `Ever Works kept the idea ${kept || 'as it is'}: ${error.message}`.slice(0, 2000)
			});
			return null;
		}
	}

	// ── Gauzy side ─────────────────────────────────────────────────────────────────────────────────

	/** The task of an id in the mapping's organization (with its teams and status row), or `null`. */
	private async task(context: EverWorksMappingContext, taskId: ID, withDeleted = false): Promise<Task | null> {
		return this.dataSource.getRepository(Task).findOne({
			where: { id: taskId, tenantId: context.tenantId, organizationId: context.organizationId } as never,
			relations: { teams: true, taskStatus: true } as never,
			withDeleted
		});
	}

	private flagsOf(task: Task): { isTodo?: boolean; isInProgress?: boolean; isDone?: boolean } {
		const row = (task as { taskStatus?: { isTodo?: boolean; isInProgress?: boolean; isDone?: boolean } | null })
			.taskStatus;
		return { isTodo: row?.isTodo, isInProgress: row?.isInProgress, isDone: row?.isDone };
	}

	/** The Gauzy status of an idea status in the task's scope (project → organization → global): `status` + `taskStatusId`. */
	private async statusChanges(
		context: EverWorksMappingContext,
		projectId: ID | null,
		ideaStatus: string
	): Promise<Record<string, unknown>> {
		const repository = this.dataSource.getRepository(TaskStatus);
		const rows = [
			...(projectId
				? await repository.find({
						where: {
							tenantId: context.tenantId,
							organizationId: context.organizationId,
							projectId
						} as never
					})
				: []),
			...(await repository.find({
				where: {
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					projectId: IsNull(),
					organizationTeamId: IsNull()
				} as never
			})),
			...(await repository.find({ where: { tenantId: IsNull(), organizationId: IsNull() } as never }))
		];
		return this.statusChangesFor(ideaStatus, rows);
	}

	private statusChangesFor(ideaStatus: string, rows: TaskStatus[]): Record<string, unknown> {
		const asTask = ideaStatusAsTaskStatus(ideaStatus);
		if (!asTask) return {};
		const row = resolveGauzyStatusRow(asTask, rows);
		if (row) return { status: row.value ?? row.name, taskStatusId: row.id };
		// No status row in scope: the platform's slug alone (every scope seeds these by default).
		const slug = {
			todo: 'open',
			in_progress: 'in-progress',
			done: 'done',
			cancelled: 'cancelled',
			blocked: 'blocked'
		} as Record<string, string>;
		return slug[asTask] ? { status: slug[asTask] } : {};
	}

	/**
	 * The idea's teams moved: the same adds and removes on `task.teams` (its scope, D11). Teams unmapped at
	 * the last sync are added again. Returns the teams of `next` Gauzy still cannot map, for the link.
	 */
	private async applyTeams(
		context: EverWorksMappingContext,
		taskId: ID,
		previous: string[],
		next: string[],
		retry: string[],
		teamMap: Map<string, ID>
	): Promise<string[]> {
		const again = new Set(retry);
		const added = gauzyTeamsFor(
			next.filter((id) => !previous.includes(id) || again.has(id)),
			teamMap
		);
		const removed = gauzyTeamsFor(
			previous.filter((id) => !next.includes(id)),
			teamMap
		).teamIds;
		const unmapped = gauzyTeamsFor(next, teamMap).unmapped;
		if (!added.teamIds.length && !removed.length) return unmapped;
		const relation = this.dataSource.createQueryBuilder().relation(Task, 'teams').of(taskId);
		const current = new Set(((await relation.loadMany()) as Array<{ id: ID }>).map((team) => team.id));
		const toAdd = added.teamIds.filter((id) => !current.has(id));
		const toRemove = removed.filter((id) => current.has(id));
		if (toAdd.length || toRemove.length) await relation.addAndRemove(toAdd, toRemove);
		return unmapped;
	}

	/** Ever Works team id → linked Gauzy team id (live pairs only). */
	private async teamMap(context: EverWorksMappingContext): Promise<Map<string, ID>> {
		const teamLinks = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter(
			(link) => link.state !== EverWorksLinkState.UNLINKED
		);
		return new Map(teamLinks.map((link) => [link.ewId, link.gauzyId as ID]));
	}

	/** The organization's `source:<value>` tag, created on first need. */
	private async sourceTagId(context: EverWorksMappingContext, source: string | null | undefined): Promise<ID | null> {
		const name = ideaSourceTag(source);
		if (!name) return null;
		const repository = this.dataSource.getRepository(Tag);
		const found = await repository.findOne({
			where: { name, tenantId: context.tenantId, organizationId: context.organizationId } as never
		});
		if (found?.id) return found.id as ID;
		const id = randomUUID() as ID;
		await repository.insert({
			id,
			name,
			color: EVER_WORKS_IDEA_ISSUE_TYPE.color,
			tenantId: context.tenantId,
			organizationId: context.organizationId
		} as never);
		return id;
	}

	private async tagSource(
		context: EverWorksMappingContext,
		taskId: ID,
		source: string | null | undefined
	): Promise<void> {
		const tagId = await this.sourceTagId(context, source);
		if (!tagId) return;
		const relation = this.dataSource.createQueryBuilder().relation(Task, 'tags').of(taskId);
		const current = (await relation.loadMany()) as Array<{ id: ID }>;
		if (!current.some((tag) => tag.id === tagId)) await relation.add(tagId);
	}

	/**
	 * Posts the Ever Works failure as a comment on the task (a system comment, plan 01 §8). With `id` (a
	 * stable one), a comment already written under it is not posted again.
	 */
	private async comment(
		context: EverWorksMappingContext,
		taskId: ID,
		failureMessage: string,
		id?: ID
	): Promise<void> {
		const repository = this.dataSource.getRepository(Comment);
		if (id && (await repository.findOne({ where: { id } as never, withDeleted: true }))) return;
		await repository.insert({
			id: id ?? randomUUID(),
			entity: BaseEntityEnum.Task,
			entityId: taskId,
			comment: `Ever Works could not build this idea: ${failureMessage}`.slice(0, 5000),
			actorType: ActorTypeEnum.System,
			tenantId: context.tenantId,
			organizationId: context.organizationId
		} as never);
	}

	/** Adds a resource link to the task; with `id` (a stable one), a link already written under it is kept. */
	private async resourceLink(
		context: EverWorksMappingContext,
		taskId: ID,
		title: string,
		url: string,
		id?: ID
	): Promise<void> {
		if (!/^https?:\/\//i.test(url)) return;
		const repository = this.dataSource.getRepository(ResourceLink);
		if (id && (await repository.findOne({ where: { id } as never, withDeleted: true }))) return;
		await repository.insert({
			id: id ?? randomUUID(),
			entity: BaseEntityEnum.Task,
			entityId: taskId,
			title,
			url,
			tenantId: context.tenantId,
			organizationId: context.organizationId
		} as never);
	}

	/**
	 * The mapping's Ideas project (`IDEAS_PROJECT_ID`): the configured one while it is active, else an
	 * active "Ever Works — Ideas" project, else one created through the platform's project command (plan
	 * 06 G-P1-4: auto-created when first needed). The sync loop's lease makes this single-writer per
	 * connection.
	 */
	private async ideasProject(context: EverWorksMappingContext, actorUserId: ID | null): Promise<ID> {
		const projects = this.dataSource.getRepository(OrganizationProject);
		const where = {
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			isActive: true,
			isArchived: false
		};
		const configured = this.setting(context, EverWorksSettingName.IDEAS_PROJECT_ID);
		if (configured && (await projects.findOne({ where: { ...where, id: configured } as never })))
			return configured as ID;
		const named = await projects.findOne({ where: { ...where, name: EVER_WORKS_IDEAS_PROJECT_NAME } as never });
		const project =
			named ??
			((await runAsGauzyUser(context, actorUserId, () =>
				this.commandBus.execute(
					new OrganizationProjectCreateCommand({
						name: EVER_WORKS_IDEAS_PROJECT_NAME,
						tenantId: context.tenantId,
						organizationId: context.organizationId,
						description: 'Created by the Ever Works integration.'
					} as never)
				)
			)) as OrganizationProject);
		await this.saveSetting(context, EverWorksSettingName.IDEAS_PROJECT_ID, project.id as ID);
		return project.id as ID;
	}

	private async saveSetting(
		context: EverWorksMappingContext,
		name: EverWorksSettingName,
		value: string
	): Promise<void> {
		const repository = this.dataSource.getRepository(IntegrationSetting);
		const existing = await repository.findOne({
			where: { integrationId: context.integrationTenantId, settingsName: name } as never
		});
		if (existing) await repository.update({ id: existing.id } as never, { settingsValue: value } as never);
		else {
			await repository.insert({
				id: randomUUID(),
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationId: context.integrationTenantId,
				settingsName: name,
				settingsValue: value
			} as never);
		}
		const row = context.mapping.settings?.find((s) => s.settingsName === name);
		if (row) row.settingsValue = value;
		else
			context.mapping.settings = [
				...(context.mapping.settings ?? []),
				{ settingsName: name, settingsValue: value } as never
			];
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private setting(context: EverWorksMappingContext, name: EverWorksSettingName): string {
		return context.mapping.settings?.find((s) => s.settingsName === name)?.settingsValue ?? '';
	}

	/** Writes go as the idea's owner (Ever Works answers someone else's idea with 404): their user id, else the key. */
	private ownerOf(ew: IdeaEverWorksOnly): string | null {
		return ew.owner?.type === 'user' ? ew.owner.id : null;
	}

	private async record(
		context: EverWorksMappingContext,
		taskId: ID,
		idea: EverWorksIdea,
		version: number | null,
		snapshot: IdeaSnapshot,
		link: EverWorksEntityLink | null,
		unmappedTeams: string[],
		direction: 'inbound' | 'outbound'
	): Promise<EverWorksEntityLink> {
		const previous = this.ewOnlyOf(link);
		const ewOnly: IdeaEverWorksOnly = {
			owner: idea.owner ?? previous.owner ?? null,
			source: idea.source ?? previous.source ?? null,
			missionId: idea.missionId !== undefined ? idea.missionId : (previous.missionId ?? null),
			targetWorkId: idea.targetWorkId !== undefined ? idea.targetWorkId : (previous.targetWorkId ?? null),
			acceptedWorkId: idea.acceptedWorkId !== undefined ? idea.acceptedWorkId : (previous.acceptedWorkId ?? null),
			failureMessage: idea.failureMessage !== undefined ? idea.failureMessage : (previous.failureMessage ?? null),
			webUrl: idea.webUrl !== undefined ? idea.webUrl : (previous.webUrl ?? null),
			visibility: idea.visibility ?? previous.visibility ?? null,
			unmappedTeams
		};
		return this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.IDEA_TASK,
			gauzyId: taskId,
			ewId: idea.id,
			ewVersion: version ?? idea.version ?? null,
			ewUpdatedAt: idea.updatedAt,
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private ewOnlyOf(link: EverWorksEntityLink | null | undefined): IdeaEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as IdeaEverWorksOnly;
		} catch {
			return {};
		}
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}
