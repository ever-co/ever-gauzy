import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ActorTypeEnum, ID, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import type { Task } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksMappingService } from '../mapping/ever-works-mapping.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import {
	everWorksPriorityToGauzy,
	everWorksStatusToGauzy,
	gauzyPriorityToEverWorks,
	gauzyStatusSlug,
	gauzyStatusToEverWorks
} from '../sync/mappers/status-priority.mapper';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import type { EverWorksOutboundHandler, EverWorksPushContext, EverWorksPushOutcome } from '../sync/outbound/ever-works-outbound.pusher';
import type { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { isSyncedVisibility, teamScopeFor } from '../teams/ever-works-team-scope';
import { escapeHtml, htmlToMarkdown, markdownToHtml } from './ever-works-markdown';
import {
	applySetChange,
	createStatusFor,
	descriptionForEverWorks,
	EverWorksPrincipalRef,
	EverWorksTask,
	EverWorksVisibilityChange,
	everWorksSideOf,
	gauzyWins,
	labelsForEverWorks,
	linkedIssueRowsFor,
	parseTaskSnapshot,
	principalKey,
	principalOf,
	relationKey,
	relationOf,
	sameField,
	stripTitleAppendix,
	TaskEverWorksOnly,
	TaskEverWorksSide,
	TaskGauzySide,
	TaskSnapshot,
	titleForEverWorks,
	transitionBlockedMessage
} from './ever-works-task.mapper';
import { EverWorksRequestContextUnavailableError, EverWorksTaskActor, EverWorksTaskScope, EverWorksTaskStore } from './ever-works-task.store';

const fromEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'ew_to_gauzy';
const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';
const lower = (value: string) => value.trim().toLowerCase();
const sortedIds = (values: ReadonlyArray<ID | string | null | undefined>) => [...new Set(values.filter((v): v is string => !!v))].sort();
const setting = (context: EverWorksMappingContext, name: EverWorksSettingName) =>
	context.mapping.settings?.find((row) => row.settingsName === name)?.settingsValue ?? '';

/** How deep the sync follows a chain of not-yet-linked parent tasks before it gives up for now. */
export const TASK_PARENT_DEPTH = 5;
/** A push waiting for a team or parent link is retried after this long. */
export const TASK_WAIT_MS = 60_000;
/** A task write this process cannot make (no request context) is retried after this long. */
export const TASK_NO_CONTEXT_RETRY_MS = 5 * 60_000;

const NO_LONGER_SHARED = 'no longer shared from Ever Works (private)';

/** How often the task sweep (watchers and linked issues changed without a captured event) runs per connection. */
export const TASK_SWEEP_MS = 10 * 60_000;
/** Task links the sweep reads per query. */
export const TASK_SWEEP_PAGE = 200;

/** An edge as Ever Works keys it on the task: `blocked:<id>` (its blocker), or `<kind>:<id>` (a relation). */
const edgeKeysOf = (side: TaskEverWorksSide) => [...(side.blockedBy ?? []).map((id) => `blocked:${id}`), ...(side.relations ?? [])];
/** An edge key → the Gauzy pair it is written as. */
function edgeOf(key: string): { kind: 'blocked' | 'related' | 'duplicates'; id: string } | null {
	if (key.startsWith('blocked:')) return { kind: 'blocked', id: key.slice('blocked:'.length) };
	const relation = relationOf(key);
	if (!relation) return null;
	return { kind: relation.kind === 'duplicates' ? 'duplicates' : 'related', id: relation.id };
}

/** The normalised Gauzy side of a task (what the sync compares and pushes). */
export function gauzySideOf(task: Task): TaskGauzySide {
	const priority = task.taskPriority?.value ?? task.priority ?? null;
	return {
		title: task.title ?? '',
		description: htmlToMarkdown(task.description),
		status: gauzyStatusSlug(task.taskStatus?.value ?? task.status) || null,
		priority: priority ? gauzyStatusSlug(priority) : null,
		tags: [...new Set((task.tags ?? []).map((tag) => (tag.name ?? '').trim()).filter(Boolean))].sort((a, b) => lower(a).localeCompare(lower(b))),
		teamIds: sortedIds((task.teams ?? []).map((team) => team.id)),
		memberIds: sortedIds((task.members ?? []).map((member) => member.id)),
		parentId: (task.parentId as ID) ?? null,
		projectId: (task.projectId as ID) ?? null
	};
}

/** The Ever Works status a Gauzy task's status maps to (known slugs, else the row's flags; plan 01 §7.1). */
function everWorksStatusOf(task: Task): string | null {
	return gauzyStatusToEverWorks(task.taskStatus?.value ?? task.status, {
		isTodo: task.taskStatus?.isTodo,
		isInProgress: task.taskStatus?.isInProgress,
		isDone: task.taskStatus?.isDone
	});
}

/**
 * Tasks (plan 01 §7, plan 06 G-P1-9), both ways, linked as `TASK`.
 *
 * - **Fields:** title (≤ 200 in Ever Works; the full title travels in the description), description
 *   (Markdown ↔ sanitised HTML), status (§7.1: the `TaskStatus` row of the task's scope by slug, then by
 *   flag; Ever Works' gates decide, so a `409 transition_blocked` puts Ever Works' status back in Gauzy
 *   with a comment saying why), priority (p0–p4 ↔ urgent/high/medium/low), labels ↔ tags (created by name),
 *   parent (parents linked first; cycles refused), assignees ↔ members (people and agent employees), watchers
 *   ↔ `manual` subscriptions (people), blockers and relations ↔ `TaskLinkedIssue` pairs on both Gauzy tasks
 *   (`follow-up` is Gauzy's "relates to", the kind kept on the link).
 * - **Scope (D11, plan 01 §2a):** `teamIds[]` ↔ `task.teams`. A Gauzy task whose team is not linked yet waits;
 *   Ever Works derives `team` / `organization` visibility from the teams (Gauzy never sets it by hand, so the
 *   automatic D11 rule keeps working); `private` tasks never sync, and one that turns private stops syncing.
 * - **Placement (§7.2):** the project of the task's work, else the Ideas project for an idea's task, else the
 *   only project of its mission's initiative, else the mapping's default project ("Ever Works").
 * - **Merge:** each side is compared with its own last-synced values, so a value the other side cannot hold
 *   exactly never flaps; a field both sides changed goes to the later writer (a tie to Ever Works), sets
 *   merge their adds and removes, and a lost description is kept as a comment (plan 03 §C.5).
 * - **Deletes (§C.3):** a task deleted in Ever Works is soft-deleted in Gauzy; a Gauzy task deleted is
 *   cancelled in Ever Works, with a comment. Both links stop syncing.
 * - Recurring templates are never synced, and tasks hidden from the board (triage) only with the setting.
 */
@Injectable()
export class EverWorksTasksService implements EverWorksInboundHandler, EverWorksOutboundHandler, EverWorksSyncSweeper {
	readonly aggregateTypes = ['task'] as const;
	readonly entityTypes = [EverWorksLinkType.TASK] as const;
	readonly sweepIntervalMs = TASK_SWEEP_MS;
	private readonly logger = new Logger('EverWorksTasks');

	constructor(
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly queue: EverWorksOutboundQueue,
		private readonly store: EverWorksTaskStore,
		private readonly mappings: EverWorksMappingService,
		private readonly log: EverWorksSyncLogService
	) {}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `task.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId ? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId) : null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.tasks)) return { status: 'skipped', message: 'tasks are not synced from Ever Works' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, envelope.aggregate.id);
		const data = (envelope.data ?? {}) as Record<string, unknown>;
		if (link?.state === EverWorksLinkState.UNLINKED) {
			// A task that turned private stopped syncing (rule 5); shared again, it resumes on the same Gauzy task.
			// Any other unlinked task (deleted on either side) stays stopped.
			const sharedAgain = link.lastError === NO_LONGER_SHARED && typeof data['visibility'] === 'string' && isSyncedVisibility(data['visibility']);
			if (!sharedAgain) return { status: 'skipped', message: 'the task is no longer synced' };
			if (envelope.type === 'task.visibility_changed') {
				try {
					return await this.refetch(context, link, envelope);
				} catch (error) {
					// No request context here (the worker): retried, like every other task write.
					if (error instanceof EverWorksRequestContextUnavailableError) return { status: 'deferred', message: error.message, retryInMs: TASK_NO_CONTEXT_RETRY_MS };
					throw error;
				}
			}
		}
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion) {
			return { status: 'skipped', message: 'already applied (version)' };
		}
		try {
			switch (envelope.type) {
				case 'task.created':
				case 'task.updated':
				case 'task.transitioned':
					return await this.applyTask(context, link, { ...(data as unknown as EverWorksTask), id: envelope.aggregate.id }, version, envelope, 0);
				case 'task.deleted':
					return await this.applyDelete(context, link, envelope);
				case 'task.visibility_changed':
					return await this.applyVisibility(context, link, data as unknown as EverWorksVisibilityChange, envelope);
				case 'task.assignee.added':
				case 'task.assignee.removed':
				case 'task.watcher.added':
				case 'task.watcher.removed':
				case 'task.block.added':
				case 'task.block.removed':
				case 'task.relation.added':
				case 'task.relation.removed':
					// Child events carry only the edge: the task is read again and applied whole (idempotent).
					return await this.refetch(context, link, envelope);
				default:
					return { status: 'skipped', message: `${envelope.type} is not synced by the task handler` };
			}
		} catch (error) {
			if (error instanceof EverWorksRequestContextUnavailableError) {
				return { status: 'deferred', message: error.message, retryInMs: TASK_NO_CONTEXT_RETRY_MS };
			}
			throw error;
		}
	}

	/** Creates or updates the Gauzy task of an Ever Works task. */
	private async applyTask(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		task: EverWorksTask,
		version: number | null,
		envelope: Pick<EverWorksEventEnvelope, 'occurredAt' | 'actor'>,
		depth: number
	): Promise<EverWorksApplyOutcome> {
		if (task.isRecurringTemplate) return { status: 'skipped', message: 'recurring templates are not synced (only their instances)' };
		if (!isSyncedVisibility(task.visibility)) {
			if (link) await this.links.unlink(link, NO_LONGER_SHARED);
			return { status: 'skipped', message: 'private tasks never sync' };
		}
		const includeHidden =
			setting(context, EverWorksSettingName.INCLUDE_HIDDEN_TASKS) === 'true' || setting(context, EverWorksSettingName.INCLUDE_TRIAGE_TASKS) === 'true';
		if (!link && task.hiddenFromBoard && !includeHidden) return { status: 'skipped', message: 'tasks hidden from the board (triage) are not synced (setting)' };
		const actor = await this.actorOf(context, envelope.actor);
		if (!link) {
			const adopted = await this.adoptOwn(context, task);
			if (!adopted) return this.createFromEverWorks(context, task, version, actor, depth);
			link = adopted;
		}
		return this.updateFromEverWorks(context, link, task, version, envelope.occurredAt, actor, depth);
	}

	/**
	 * A task Gauzy pushed itself whose link was not recorded (the answer was lost): Ever Works lists our
	 * external link on it, so it is linked back instead of being created a second time in Gauzy.
	 */
	private async adoptOwn(context: EverWorksMappingContext, task: EverWorksTask): Promise<EverWorksEntityLink | null> {
		const own = (task.externalLinks ?? []).find(
			(row) => row.source === EVER_WORKS_LINK_SOURCE && (!row.installationId || row.installationId === context.connection.id)
		);
		if (!own?.externalId) return null;
		const gauzyTask = await this.store.load(context.tenantId, own.externalId as ID);
		if (!gauzyTask || gauzyTask.organizationId !== context.organizationId) return null;
		const existing = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, gauzyTask.id as ID);
		if (existing) return existing.ewId === task.id ? existing : null;
		// The Gauzy side as it is and no Ever Works side yet: the update that follows applies Ever Works'
		// current values (the task was created from this one; Ever Works may have edited it since).
		await this.record(context, gauzyTask.id as ID, task, null, { g: await this.gauzySide(context, gauzyTask), e: {} }, 'inbound', {});
		return this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, gauzyTask.id as ID);
	}

	private async createFromEverWorks(
		context: EverWorksMappingContext,
		task: EverWorksTask,
		version: number | null,
		actor: EverWorksTaskActor,
		depth: number
	): Promise<EverWorksApplyOutcome> {
		const projectId = await this.placement(context, task, actor);
		if (!projectId) return { status: 'deferred', message: 'no Gauzy project to place the task in yet', retryInMs: TASK_WAIT_MS };
		const teams = await this.gauzyTeamsOf(context, task.teamIds ?? []);
		const members = await this.gauzyMembersOf(context, (task.assignees ?? []).map(principalKey));
		const parent = task.parentTaskId ? await this.ensureTaskLinked(context, task.parentTaskId, depth + 1) : null;
		const scope: EverWorksTaskScope = { tenantId: context.tenantId, organizationId: context.organizationId, projectId, teamId: teams.ids[0] ?? null };
		const statusTarget = everWorksStatusToGauzy(task.status);
		const status = statusTarget ? await this.store.statusFor(scope, task.status, statusTarget.slug) : null;
		const prioritySlug = everWorksPriorityToGauzy(task.priority);
		const priority = prioritySlug ? await this.store.priorityFor(scope, prioritySlug) : null;
		const tags = await this.store.ensureTags(context.tenantId, context.organizationId, task.labels ?? []);
		const input: Partial<ITaskCreateInput> = {
			title: task.title,
			description: markdownToHtml(stripTitleAppendix(task.description)),
			...(status ? { status: status.value as never, ...(status.id ? { taskStatusId: status.id } : {}) } : {}),
			...(priority ? { priority: priority.value as never, ...(priority.id ? { taskPriorityId: priority.id } : {}) } : {}),
			projectId,
			...(parent ? { parentId: parent } : {}),
			members: members.ids.map((id) => ({ id })) as never,
			teams: teams.ids.map((id) => ({ id })) as never,
			tags: tags.map((tag) => ({ id: tag.id })) as never,
			tenantId: context.tenantId,
			organizationId: context.organizationId
		};
		const taskId = await this.store.asActor(context, actor, () => this.store.create(input));
		// A parent that could not be linked yet stays a difference on the Ever Works side: the next change retries it.
		const e = { ...everWorksSideOf(task), ...(task.parentTaskId && !parent ? { parentTaskId: null } : {}) };
		const fresh = await this.store.load(context.tenantId, taskId);
		if (!fresh) throw new Error(`The Gauzy task created for Ever Works task ${task.id} cannot be read back.`);
		// The link is recorded before the edges are followed: an edge back to this task (two new tasks that
		// relate to each other) then finds it instead of importing it a second time. Its watchers and edges are
		// not on the Gauzy side yet, so they count as Ever Works' change below — and it has no version yet, so
		// if following an edge fails, the retried event is not skipped as applied and finishes them.
		await this.record(
			context,
			taskId,
			task,
			null,
			{ g: await this.gauzySide(context, fresh), e: { ...e, watchers: [], blockedBy: [], relations: [] } },
			'inbound',
			{ unmappedTeams: teams.unmapped, unmappedAssignees: members.unmapped }
		);
		const edges = await this.applyEdgeSets(context, taskId, {}, e, { watcherIds: [], blockedBy: [], relations: [] }, {}, depth);
		const created = (await this.store.load(context.tenantId, taskId)) ?? fresh;
		await this.record(context, taskId, task, version ?? task.version ?? null, { g: await this.gauzySide(context, created), e }, 'inbound', {
			unmappedTeams: teams.unmapped,
			unmappedAssignees: members.unmapped,
			unmappedWatchers: edges.unmappedWatchers,
			unmappedEdges: edges.unmappedEdges
		});
		await this.putExternalLink(context, task.id, taskId);
		this.logger.log(`Ever Works task ${task.id} created as Gauzy task ${taskId} (organization ${context.organizationId}).`);
		return { status: 'applied' };
	}

	private async updateFromEverWorks(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		task: EverWorksTask,
		version: number | null,
		occurredAt: string | null | undefined,
		actor: EverWorksTaskActor,
		depth: number
	): Promise<EverWorksApplyOutcome> {
		const row = await this.store.load(context.tenantId, link.gauzyId as ID);
		if (!row) return { status: 'skipped', message: 'the Gauzy task is gone' };
		if ((row as { deletedAt?: Date | null }).deletedAt) return { status: 'skipped', message: 'the Gauzy task was deleted (its delete is pushed)' };
		const snapshot = parseTaskSnapshot(this.links.snapshot<TaskSnapshot>(link));
		const prevE = snapshot.e;
		const prevG = snapshot.g;
		const ewOnly = this.everWorksOnly(link);
		const e = everWorksSideOf(task);
		/** The Ever Works side as recorded: a field that could not be applied yet keeps its old value (retried). */
		const eRecorded: TaskEverWorksSide = { ...e };
		const g = await this.gauzySide(context, row);
		const everWorksChanged = (field: keyof TaskEverWorksSide) => !(field in prevE) || !sameField(e[field], prevE[field]);
		const gauzyChanged = (field: keyof TaskGauzySide) => field in prevG && !sameField(g[field], prevG[field]);
		const gauzyAt = (row as { updatedAt?: Date }).updatedAt ?? null;
		const conflicts: Array<{ field: string; gauzy: unknown; everWorks: unknown; winner: 'gauzy' | 'ever_works' }> = [];
		/** A scalar Ever Works changed: apply it, unless Gauzy changed it too, later (last writer wins). */
		const takes = (eField: keyof TaskEverWorksSide, gField: keyof TaskGauzySide): boolean => {
			if (!everWorksChanged(eField)) return false;
			if (!gauzyChanged(gField)) return true;
			const winner = gauzyWins(gauzyAt, occurredAt) ? 'gauzy' : 'ever_works';
			conflicts.push({ field: gField, gauzy: g[gField], everWorks: e[eField], winner });
			return winner === 'ever_works';
		};
		const input: Partial<ITaskUpdateInput> = {};
		const applied = new Set<keyof TaskGauzySide>();
		/** The description that lost a conflict, kept as a comment (plan 03 §C.5): `side` is whose it was. */
		let lostDescription: { side: 'gauzy' | 'ever_works'; html: string } | null = null;

		if (takes('title', 'title') && task.title && task.title !== row.title) {
			input.title = task.title;
			applied.add('title');
		}
		if (takes('description', 'description')) {
			const html = markdownToHtml(stripTitleAppendix(task.description));
			if (html !== (row.description ?? '')) {
				if (gauzyChanged('description')) lostDescription = { side: 'gauzy', html: row.description ?? '' };
				input.description = html;
			}
			applied.add('description');
		} else if (conflicts.some((conflict) => conflict.field === 'description' && conflict.winner === 'gauzy')) {
			// Gauzy's later description is pushed over Ever Works' edit: that edit is kept here first.
			lostDescription = { side: 'ever_works', html: markdownToHtml(stripTitleAppendix(task.description)) };
		}
		if (takes('priority', 'priority')) {
			const slug = everWorksPriorityToGauzy(task.priority);
			// p2 and p3 are both "medium": a move between them writes nothing (lossy fields never flap).
			if (slug && slug !== g.priority) {
				const option = await this.store.priorityFor(this.scopeOf(context, row), slug);
				input.priority = option.value as never;
				// The row id goes with the value, `null` included: a stale priority row must not stay attached.
				input.taskPriorityId = (option.id ?? null) as never;
			}
			applied.add('priority');
		}
		/** Set fields whose Gauzy snapshot moves by Ever Works' change only (not to Gauzy's whole current set). */
		const setSnapshots: Partial<Record<'tags' | 'teamIds' | 'memberIds' | 'watcherIds' | 'blockedBy' | 'relations', string[]>> = {};
		if (everWorksChanged('labels')) {
			const names = applySetChange(g.tags ?? [], prevE.labels ?? [], e.labels ?? [], lower);
			if (!sameField(names, g.tags)) {
				input.tags = (await this.store.ensureTags(context.tenantId, context.organizationId, names)).map((tag) => ({ id: tag.id })) as never;
			}
			setSnapshots.tags = applySetChange(prevG.tags ?? g.tags ?? [], prevE.labels ?? [], e.labels ?? [], lower).sort((a, b) => lower(a).localeCompare(lower(b)));
		}
		let unmappedTeams = ewOnly.unmappedTeams ?? [];
		let nextTeamIds: ID[] | null = null;
		if (everWorksChanged('teamIds') || unmappedTeams.length) {
			const result = await this.mergeIntoGauzy(g.teamIds ?? [], prevE.teamIds ?? [], e.teamIds ?? [], unmappedTeams, (ids) => this.gauzyTeamsOf(context, ids));
			unmappedTeams = result.unmapped;
			if (!sameField(result.ids, g.teamIds)) {
				nextTeamIds = result.ids;
				input.teams = result.ids.map((id) => ({ id })) as never;
			}
			setSnapshots.teamIds = EverWorksTasksService.moved(prevG.teamIds, g.teamIds, result);
		}
		let unmappedAssignees = ewOnly.unmappedAssignees ?? [];
		if (everWorksChanged('assignees') || unmappedAssignees.length) {
			const result = await this.mergeIntoGauzy(g.memberIds ?? [], prevE.assignees ?? [], e.assignees ?? [], unmappedAssignees, (keys) => this.gauzyMembersOf(context, keys));
			unmappedAssignees = result.unmapped;
			if (!sameField(result.ids, g.memberIds)) input.members = result.ids.map((id) => ({ id })) as never;
			setSnapshots.memberIds = EverWorksTasksService.moved(prevG.memberIds, g.memberIds, result);
		}
		if (takes('parentTaskId', 'parentId')) {
			const parentId = e.parentTaskId ? await this.ensureTaskLinked(context, e.parentTaskId, depth + 1) : null;
			// `undefined`: the parent cannot be linked right now; the next change of the task tries again.
			if (parentId !== undefined && parentId !== (row.parentId ?? null)) {
				if (parentId && (await this.store.isSelfOrAncestor(row.id as ID, parentId))) {
					await this.logConflict(context, row.id as ID, task.id, 'parent_cycle_refused', 'The Ever Works parent would make a cycle in Gauzy; it is not applied.');
				} else {
					input.parentId = parentId as never;
					applied.add('parentId');
				}
			} else if (parentId !== undefined) {
				applied.add('parentId');
			} else {
				eRecorded.parentTaskId = prevE.parentTaskId ?? null;
			}
		}
		if (everWorksChanged('workId') && e.workId) {
			// A task moves only to the project of a linked work; to an unlinked work (or none) it stays where it is.
			const workLink = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, e.workId);
			const projectId = workLink && workLink.state !== EverWorksLinkState.UNLINKED ? (workLink.gauzyId as ID) : null;
			if (projectId && projectId !== row.projectId && (!gauzyChanged('projectId') || !gauzyWins(gauzyAt, occurredAt))) {
				if (await this.store.projectExists(context.tenantId, context.organizationId, projectId)) {
					input.projectId = projectId;
					applied.add('projectId');
				}
			}
		}
		if (takes('status', 'status')) {
			const target = everWorksStatusToGauzy(task.status);
			if (target) {
				const teams = nextTeamIds ?? g.teamIds ?? [];
				const scope: EverWorksTaskScope = { ...this.scopeOf(context, row), projectId: (input.projectId as ID) ?? (row.projectId as ID) ?? null, teamId: (teams[0] as ID) ?? null };
				const option = await this.store.statusFor(scope, task.status, target.slug);
				if (option.value !== row.status || (option.id ?? null) !== (row.taskStatusId ?? null)) {
					input.status = option.value as never;
					// The row id goes with the value, `null` included: a stale status row must not stay attached.
					input.taskStatusId = (option.id ?? null) as never;
				}
				applied.add('status');
			}
		}

		if (Object.keys(input).length) await this.store.asActor(context, actor, () => this.store.update(row.id as ID, input));
		const edges = await this.applyEdgeSets(context, row.id as ID, prevE, e, g, ewOnly, depth, prevG);
		Object.assign(setSnapshots, edges.snapshot);
		const after = Object.keys(input).length ? ((await this.store.load(context.tenantId, row.id as ID)) ?? row) : row;
		if (lostDescription !== null) {
			// Nothing is lost: the version the later edit replaced is kept as a comment (plan 03 §C.5).
			const note =
				lostDescription.side === 'gauzy'
					? `Conflicting edit: this description was replaced by a later edit from Ever Works at ${occurredAt ?? 'an unknown time'}. The Gauzy version was:`
					: `Conflicting edit: a later Gauzy edit replaced this Ever Works description (edited at ${occurredAt ?? 'an unknown time'}). The Ever Works version was:`;
			await this.store.addComment(context, row.id as ID, `<p><em>${escapeHtml(note)}</em></p>${lostDescription.html}`, ActorTypeEnum.System);
		}
		// The Gauzy snapshot moves only for what was applied here: a Gauzy edit not pushed yet stays a difference.
		const gAfter = await this.gauzySide(context, after);
		const nextG: TaskGauzySide = { ...prevG };
		for (const field of Object.keys(gAfter) as Array<keyof TaskGauzySide>) {
			if (applied.has(field) || !(field in prevG)) Object.assign(nextG, { [field]: gAfter[field] });
		}
		Object.assign(nextG, setSnapshots);
		await this.record(
			context,
			row.id as ID,
			task,
			version ?? task.version ?? null,
			{ g: nextG, e: eRecorded },
			'inbound',
			{ unmappedTeams, unmappedAssignees, unmappedWatchers: edges.unmappedWatchers, unmappedEdges: edges.unmappedEdges },
			link
		);
		for (const conflict of conflicts) {
			await this.logConflict(context, row.id as ID, task.id, `conflict:${conflict.field}`, `Both sides changed ${conflict.field}; the later edit (${conflict.winner === 'gauzy' ? 'Gauzy' : 'Ever Works'}) won.`, conflict);
		}
		if (conflicts.some((conflict) => conflict.winner === 'gauzy')) {
			// Gauzy's later value goes out: its change is (still) a difference from the snapshot.
			await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: row.id as ID, op: 'upsert' });
		}
		return { status: 'applied' };
	}

	/**
	 * Watchers and edges Ever Works changed (`previous` → `next`), applied to the Gauzy task: watchers as
	 * `manual` subscriptions (people only); blockers and relations as `TaskLinkedIssue` pairs on both tasks.
	 * The other task of an edge is linked first (fetched from Ever Works when needed). The pair row a
	 * relation writes on the other task is recorded on that task's link, so it is not pushed back.
	 */
	private async applyEdgeSets(
		context: EverWorksMappingContext,
		taskId: ID,
		prevE: TaskEverWorksSide,
		e: TaskEverWorksSide,
		g: TaskGauzySide,
		ewOnly: TaskEverWorksOnly,
		depth: number,
		previousGauzy: TaskGauzySide = {}
	): Promise<{ snapshot: Pick<TaskGauzySide, 'watcherIds' | 'blockedBy' | 'relations'>; unmappedWatchers: string[]; unmappedEdges: string[] }> {
		// The Gauzy snapshot of these sets moves by exactly what is applied here, so a Gauzy edit not pushed yet
		// stays a difference (it is pushed next).
		const snapshot: Pick<TaskGauzySide, 'watcherIds' | 'blockedBy' | 'relations'> = {};
		/** The previous Gauzy snapshot of a set, or (none yet) Gauzy's current one. */
		const prevG = (current: TaskGauzySide, field: 'watcherIds' | 'blockedBy' | 'relations') => (field in previousGauzy ? previousGauzy[field] : current[field]);
		const scope = { tenantId: context.tenantId, organizationId: context.organizationId };
		let unmappedWatchers = ewOnly.unmappedWatchers ?? [];
		if (!('watchers' in prevE) || !sameField(e.watchers, prevE.watchers) || unmappedWatchers.length) {
			const retry = new Set(unmappedWatchers);
			const previous = prevE.watchers ?? [];
			const next = e.watchers ?? [];
			const current = new Set(g.watcherIds ?? []);
			const change = { added: [] as string[], removed: [] as string[] };
			unmappedWatchers = [];
			for (const userId of previous.filter((id) => !next.includes(id))) {
				const employeeId = await this.employeeOfUser(context, userId);
				if (!employeeId) continue;
				if (current.has(employeeId)) await this.store.removeWatcher(context.tenantId, taskId, employeeId);
				change.removed.push(employeeId);
			}
			for (const userId of next.filter((id) => !previous.includes(id) || retry.has(id))) {
				const employeeId = await this.employeeOfUser(context, userId);
				if (!employeeId) {
					unmappedWatchers.push(userId);
					continue;
				}
				if (!current.has(employeeId)) await this.store.addWatcher(scope, taskId, employeeId);
				change.added.push(employeeId);
			}
			snapshot.watcherIds = EverWorksTasksService.moved(prevG(g, 'watcherIds'), g.watcherIds, change);
		}
		let unmappedEdges = ewOnly.unmappedEdges ?? [];
		const edgesChanged = !('blockedBy' in prevE) || !sameField(e.blockedBy, prevE.blockedBy) || !sameField(e.relations, prevE.relations);
		if (edgesChanged || unmappedEdges.length) {
			const retry = new Set(unmappedEdges);
			const previous = edgeKeysOf(prevE);
			const next = edgeKeysOf(e);
			const mirrors = new Map<ID, { add: string[]; remove: string[] }>();
			/** Gauzy-side edge keys (`blocked:<id>`, `related:<id>`, `duplicates:<id>`) applied here. */
			const change = { added: [] as string[], removed: [] as string[] };
			const gauzyKey = (kind: 'blocked' | 'related' | 'duplicates', otherId: string) => `${kind}:${otherId}`;
			const mirror = (otherId: ID) => mirrors.get(otherId) ?? (mirrors.set(otherId, { add: [], remove: [] }).get(otherId) as { add: string[]; remove: string[] });
			unmappedEdges = [];
			for (const key of previous.filter((k) => !next.includes(k))) {
				const edge = edgeOf(key);
				// `related` and `follow-up` are one Gauzy relation: it stays while the other kind still holds it.
				if (!edge || (edge.kind === 'related' && next.some((k) => relationKey(k) === relationKey(key)))) continue;
				const other = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, edge.id);
				if (!other || other.state === EverWorksLinkState.UNLINKED) continue;
				await this.store.deleteLinkedIssues(context.tenantId, linkedIssueRowsFor(edge.kind, taskId, other.gauzyId as ID));
				change.removed.push(gauzyKey(edge.kind, other.gauzyId as ID));
				if (edge.kind === 'related') mirror(other.gauzyId as ID).remove.push(`related:${taskId}`);
			}
			for (const key of next.filter((k) => !previous.includes(k) || retry.has(k))) {
				const edge = edgeOf(key);
				if (!edge) continue;
				const otherId = await this.ensureTaskLinked(context, edge.id, depth + 1);
				if (otherId === undefined) unmappedEdges.push(key);
				if (!otherId || otherId === taskId) continue;
				await this.store.ensureLinkedIssues(scope, linkedIssueRowsFor(edge.kind, taskId, otherId));
				change.added.push(gauzyKey(edge.kind, otherId));
				if (edge.kind === 'related') mirror(otherId).add.push(`related:${taskId}`);
			}
			for (const [otherId, mirrored] of mirrors) await this.absorbMirror(context, otherId, mirrored);
			const blocked = (keys: string[]) => keys.filter((k) => k.startsWith('blocked:')).map((k) => k.slice('blocked:'.length));
			const related = (keys: string[]) => keys.filter((k) => !k.startsWith('blocked:'));
			snapshot.blockedBy = EverWorksTasksService.moved(prevG(g, 'blockedBy'), g.blockedBy, { added: blocked(change.added), removed: blocked(change.removed) });
			snapshot.relations = EverWorksTasksService.moved(prevG(g, 'relations'), g.relations, { added: related(change.added), removed: related(change.removed) });
		}
		return { snapshot, unmappedWatchers, unmappedEdges };
	}

	/** Records the pair rows the sync wrote on another task in that task's snapshot (they mirror Ever Works). */
	private async absorbMirror(context: EverWorksMappingContext, taskId: ID, change: { add: string[]; remove: string[] }): Promise<void> {
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, taskId);
		if (!link || link.state === EverWorksLinkState.UNLINKED) return;
		const snapshot = parseTaskSnapshot(this.links.snapshot<TaskSnapshot>(link));
		if (!('relations' in snapshot.g)) return;
		const relations = new Set(snapshot.g.relations ?? []);
		for (const key of change.remove) relations.delete(key);
		for (const key of change.add) relations.add(key);
		await this.record(context, taskId, null, link.ewVersion ?? null, { g: { ...snapshot.g, relations: [...relations].sort() }, e: snapshot.e }, 'inbound', null, link);
	}

	/** The Gauzy employee of an Ever Works user (a linked person), or `null`. */
	private async employeeOfUser(context: EverWorksMappingContext, userId: string): Promise<ID | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, userId);
		return link && link.state !== EverWorksLinkState.UNLINKED ? (link.gauzyId as ID) : null;
	}

	/** The Gauzy side of a task with its watchers and linked issues (what the sync compares and pushes). */
	private async gauzySide(context: EverWorksMappingContext, task: Task): Promise<TaskGauzySide> {
		const id = task.id as ID;
		const [watchers, edges] = await Promise.all([this.store.watchersOf(context.tenantId, [id]), this.store.edgesOf(context.tenantId, [id])]);
		const edge = edges.get(id) ?? { blockedBy: [], relations: [] };
		return { ...gauzySideOf(task), watcherIds: watchers.get(id) ?? [], blockedBy: edge.blockedBy, relations: edge.relations };
	}

	/**
	 * Ever Works' set moved from `previous` to `next`: the same adds and removes on Gauzy's current set,
	 * in Gauzy ids. Members Gauzy could not map at the last sync are tried again (paired since then → added).
	 */
	private async mergeIntoGauzy(
		current: ReadonlyArray<string>,
		previous: ReadonlyArray<string>,
		next: ReadonlyArray<string>,
		previouslyUnmapped: ReadonlyArray<string>,
		resolve: (everWorksIds: string[]) => Promise<{ ids: ID[]; unmapped: string[] }>
	): Promise<{ ids: ID[]; unmapped: string[]; added: ID[]; removed: ID[] }> {
		const retry = new Set(previouslyUnmapped);
		const removed = await resolve(previous.filter((id) => !next.includes(id)));
		const added = await resolve(next.filter((id) => !previous.includes(id) || retry.has(id)));
		const ids = current.filter((id) => !removed.ids.includes(id as ID));
		for (const id of added.ids) if (!ids.includes(id)) ids.push(id);
		return { ids: sortedIds(ids) as ID[], unmapped: added.unmapped, added: added.ids, removed: removed.ids };
	}

	/** A set of the Gauzy snapshot moved by exactly what Ever Works added and removed (nothing of Gauzy's own). */
	private static moved(snapshot: ReadonlyArray<string> | undefined, current: ReadonlyArray<string> | undefined, change: { added: ReadonlyArray<string>; removed: ReadonlyArray<string> }): string[] {
		const base = snapshot ?? current ?? [];
		const result = base.filter((id) => !change.removed.includes(id));
		for (const id of change.added) if (!result.includes(id)) result.push(id);
		return sortedIds(result);
	}

	/** An Ever Works delete: the Gauzy task is soft-deleted (plan 01 §7 delete policy) and its link stops syncing. */
	private async applyDelete(context: EverWorksMappingContext, link: EverWorksEntityLink | null, envelope: EverWorksEventEnvelope): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the task is not linked' };
		const row = await this.store.load(context.tenantId, link.gauzyId as ID);
		if (row && !(row as { deletedAt?: Date | null }).deletedAt) {
			const actor = await this.actorOf(context, envelope.actor);
			await this.store.asActor(context, actor, () => this.store.softDelete(row.id as ID));
		}
		await this.links.unlink(link, 'deleted in Ever Works; the Gauzy task is deleted (soft, restorable)');
		return { status: 'applied' };
	}

	/** `task.visibility_changed`: to `private` stops syncing (rule 5); a task that became shared is read and linked. */
	private async applyVisibility(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		change: EverWorksVisibilityChange,
		envelope: EverWorksEventEnvelope
	): Promise<EverWorksApplyOutcome> {
		if (!isSyncedVisibility(change.visibility)) {
			if (link) await this.links.unlink(link, NO_LONGER_SHARED);
			return { status: 'applied', message: 'private: no longer synced' };
		}
		if (link) return { status: 'skipped', message: 'the scope follows the task teams' };
		return this.refetch(context, null, envelope);
	}

	/** Reads the task from Ever Works and applies it whole. */
	private async refetch(context: EverWorksMappingContext, link: EverWorksEntityLink | null, envelope: EverWorksEventEnvelope): Promise<EverWorksApplyOutcome> {
		const task = await this.fetchTask(context, envelope.aggregate.id);
		if (!task) return { status: 'skipped', message: 'the task is not visible in Ever Works any more' };
		return this.applyTask(context, link, task, task.version ?? envelope.aggregate.version ?? null, envelope, 0);
	}

	/**
	 * The Gauzy task of an Ever Works task, linking it first when needed (parents before children, plan 03
	 * §C.4 step 2). `null`: there is no such task (any more); `undefined`: it cannot be linked right now.
	 */
	private async ensureTaskLinked(context: EverWorksMappingContext, everWorksTaskId: string, depth: number): Promise<ID | null | undefined> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, everWorksTaskId);
		if (link) return link.state === EverWorksLinkState.UNLINKED ? undefined : (link.gauzyId as ID);
		if (depth > TASK_PARENT_DEPTH) return undefined;
		const task = await this.fetchTask(context, everWorksTaskId);
		if (!task) return null;
		const outcome = await this.applyTask(context, null, task, task.version ?? null, { occurredAt: task.updatedAt ?? new Date().toISOString(), actor: { type: 'system', id: null } }, depth);
		if (outcome.status !== 'applied') return undefined;
		const linked = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TASK, everWorksTaskId);
		return linked && linked.state !== EverWorksLinkState.UNLINKED ? (linked.gauzyId as ID) : undefined;
	}

	/** The project an Ever Works task lands in (plan 01 §7.2). */
	private async placement(context: EverWorksMappingContext, task: EverWorksTask, actor: EverWorksTaskActor): Promise<ID | null> {
		if (task.workId) {
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, task.workId);
			if (link && link.state !== EverWorksLinkState.UNLINKED && (await this.store.projectExists(context.tenantId, context.organizationId, link.gauzyId as ID))) {
				return link.gauzyId as ID;
			}
		}
		if (task.ideaId) return this.syncProject(context, 'ideas', actor);
		if (task.missionId) {
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.INITIATIVE_MISSION, task.missionId);
			if (link && link.state !== EverWorksLinkState.UNLINKED) {
				const projects = await this.store.initiativeProjects(link.gauzyId as ID);
				if (projects.length === 1) return projects[0] as ID;
			}
		}
		return this.syncProject(context, 'default', actor);
	}

	/** The mapping's default or Ideas project, created on first need (through the platform's project command). */
	private async syncProject(context: EverWorksMappingContext, kind: 'default' | 'ideas', actor: EverWorksTaskActor): Promise<ID | null> {
		const configured = setting(context, kind === 'ideas' ? EverWorksSettingName.IDEAS_PROJECT_ID : EverWorksSettingName.DEFAULT_PROJECT_ID);
		if (configured && (await this.store.projectExists(context.tenantId, context.organizationId, configured as ID))) return configured as ID;
		const projectId = await this.store.asActor(context, actor, () =>
			this.mappings.ensureProjectForSync(context.tenantId, context.organizationId, context.integrationTenantId, kind)
		);
		return projectId ?? null;
	}

	/** Who a change from Ever Works is attributed to in Gauzy (plan 01 §3). */
	private async actorOf(context: EverWorksMappingContext, actor: EverWorksEventEnvelope['actor'] | undefined): Promise<EverWorksTaskActor> {
		const type = actor?.type === 'agent' ? EverWorksLinkType.AGENT : actor?.type === 'user' ? EverWorksLinkType.MEMBER : null;
		if (type && actor?.id) {
			const link = await this.links.byEw(context.integrationTenantId, type, actor.id);
			if (link && link.state !== EverWorksLinkState.UNLINKED) {
				const user = await this.store.userOfEmployee(link.gauzyId as ID);
				if (user.userId) return { userId: user.userId, name: user.name ?? actor.label ?? 'Ever Works', agent: type === EverWorksLinkType.AGENT, employeeId: link.gauzyId as ID };
			}
		}
		// An unmapped person, the integration or the system: the admin who connected Ever Works.
		return { userId: (context.connection.connectedByUserId as ID) ?? null, name: actor?.label || 'Ever Works', agent: false, employeeId: null };
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy task changed (or was deleted). */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id) return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.tasks)) return { status: 'skipped', message: 'tasks are not pushed to Ever Works' };
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, change.gauzyId as ID);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the task is no longer synced' };
		const task = await this.store.load(context.tenantId, change.gauzyId as ID);
		try {
			if (change.op === 'delete' || !task || (task as { deletedAt?: Date | null }).deletedAt) return await this.pushDelete(context, link, change);
			if (task.organizationId !== context.organizationId) return { status: 'skipped', message: 'the task belongs to another organization now' };
			const excluded = await this.excluded(context, task);
			if (excluded) return { status: 'skipped', message: excluded };
			const client = this.client(context);
			const actAs = await this.actAsFor(context, change.actorUserId ?? null);
			return link ? await this.updateInEverWorks(context, client, task, link, actAs) : await this.createInEverWorks(context, client, task, actAs, change);
		} catch (error) {
			if (error instanceof EverWorksRequestContextUnavailableError) {
				return { status: 'deferred', message: error.message, retryInMs: TASK_NO_CONTEXT_RETRY_MS };
			}
			throw error;
		}
	}

	/** Why a Gauzy task is not pushed, or `null` when it is. */
	private async excluded(context: EverWorksMappingContext, task: Task): Promise<string | null> {
		const ideaTypeId = setting(context, EverWorksSettingName.IDEA_ISSUE_TYPE_ID);
		if (String(task.issueType ?? '').toLowerCase() === 'idea' || (ideaTypeId && task.taskTypeId === ideaTypeId)) {
			return 'ideas sync as Ever Works ideas (plan 01 §8), not as tasks';
		}
		const projectLink = task.projectId ? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, task.projectId as ID) : null;
		const linkedProject = !!projectLink && projectLink.state !== EverWorksLinkState.UNLINKED;
		if (!linkedProject && setting(context, EverWorksSettingName.SYNC_UNLINKED_PROJECT_TASKS) === 'false') {
			return 'tasks of projects not linked to a work are not synced (setting)';
		}
		return null;
	}

	/** What a push sends, computed from the Gauzy task; or why it has to wait. */
	private async outgoing(
		context: EverWorksMappingContext,
		task: Task
	): Promise<
		| { wait: string; teamIds?: undefined }
		| {
				wait?: undefined;
				g: TaskGauzySide;
				teamIds: string[];
				workId: string | null;
				parentTaskId: string | null;
				assignees: EverWorksPrincipalRef[];
				labels: string[];
				watchers: string[];
				blockedBy: string[];
				relations: string[];
				pendingWatchers: string[];
				pendingEdges: string[];
		  }
	> {
		const g = await this.gauzySide(context, task);
		const teamOf = new Map<ID, string>();
		for (const teamId of g.teamIds ?? []) {
			const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, teamId as ID);
			if (link && link.state !== EverWorksLinkState.UNLINKED) teamOf.set(teamId as ID, link.ewId);
		}
		const scope = teamScopeFor((g.teamIds ?? []) as ID[], teamOf);
		if (!scope.scope) return { wait: `the team ${scope.waitingFor} is not linked to Ever Works yet` };
		let parentTaskId: string | null = null;
		if (g.parentId) {
			const parentLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, g.parentId as ID);
			if (parentLink && parentLink.state !== EverWorksLinkState.UNLINKED) {
				parentTaskId = parentLink.ewId;
			} else if (!parentLink) {
				// Parents go first: a parent that will sync is queued, and this task waits for its link.
				const parent = await this.store.load(context.tenantId, g.parentId as ID);
				if (parent && !(parent as { deletedAt?: Date | null }).deletedAt && parent.organizationId === context.organizationId && !(await this.excluded(context, parent))) {
					await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: parent.id as ID, op: 'upsert' });
					return { wait: `the parent task ${parent.id} is not in Ever Works yet` };
				}
			}
		}
		const workLink = g.projectId ? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, g.projectId as ID) : null;
		const workId = workLink && workLink.state !== EverWorksLinkState.UNLINKED ? workLink.ewId : null;
		const assignees: EverWorksPrincipalRef[] = [];
		for (const employeeId of g.memberIds ?? []) {
			const ref = await this.principalFor(context, employeeId as ID);
			if (ref) assignees.push(ref);
		}
		// Watchers are people only; an edge whose other task is not in Ever Works yet is pushed once it is (the
		// other task is queued, and the sweep retries what is pending).
		const watchers: string[] = [];
		const pendingWatchers: string[] = [];
		for (const employeeId of g.watcherIds ?? []) {
			const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId as ID);
			if (person && person.state !== EverWorksLinkState.UNLINKED) watchers.push(person.ewId);
			else pendingWatchers.push(employeeId);
		}
		const blockedBy: string[] = [];
		const relations: string[] = [];
		const pendingEdges: string[] = [];
		for (const key of [...(g.blockedBy ?? []).map((id) => `blocked:${id}`), ...(g.relations ?? [])]) {
			const edge = edgeOf(key);
			if (!edge) continue;
			const ewTaskId = await this.everWorksTaskOf(context, edge.id as ID);
			if (!ewTaskId) {
				pendingEdges.push(key);
				continue;
			}
			if (edge.kind === 'blocked') blockedBy.push(ewTaskId);
			else relations.push(`${edge.kind}:${ewTaskId}`);
		}
		return {
			g,
			teamIds: scope.scope.teamIds,
			workId,
			parentTaskId,
			assignees,
			labels: labelsForEverWorks(g.tags ?? []),
			watchers: watchers.sort(),
			blockedBy: blockedBy.sort(),
			relations: relations.sort(),
			pendingWatchers,
			pendingEdges
		};
	}

	/** The Ever Works task of a Gauzy task; a task that will sync but is not linked yet is queued (→ `null`). */
	private async everWorksTaskOf(context: EverWorksMappingContext, taskId: ID): Promise<string | null> {
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, taskId);
		if (link) return link.state === EverWorksLinkState.UNLINKED ? null : link.ewId;
		const task = await this.store.load(context.tenantId, taskId);
		if (task && !(task as { deletedAt?: Date | null }).deletedAt && task.organizationId === context.organizationId && !(await this.excluded(context, task))) {
			await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: taskId, op: 'upsert' });
		}
		return null;
	}

	/** `PUT /tasks/:id/watchers|blocks|relations` (full sets); a refusal of a set (e.g. a blocking cycle, 422) is logged. */
	private async putSets(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		taskId: ID,
		everWorksTaskId: string,
		sets: { watchers?: string[]; blockedBy?: string[]; relations?: string[] },
		version: number | undefined,
		actAs: string | null
	): Promise<{ task: EverWorksTask | null; version: number | undefined }> {
		const path = `/tasks/${encodeURIComponent(everWorksTaskId)}`;
		const calls: Array<[string, Record<string, unknown>]> = [];
		if (sets.watchers) calls.push(['watchers', { userIds: sets.watchers }]);
		if (sets.blockedBy) calls.push(['blocks', { blockedBy: sets.blockedBy }]);
		if (sets.relations) calls.push(['relations', { relations: sets.relations.map((key) => ({ taskId: relationOf(key)?.id, kind: relationOf(key)?.kind })) }]);
		let task: EverWorksTask | null = null;
		for (const [name, body] of calls) {
			try {
				task = await this.withActAs(actAs, (actor) => client.request<EverWorksTask>('PUT', `${path}/${name}`, { body, ifMatchVersion: version, actAsUserId: actor }));
				version = task?.version ?? version;
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 422)) throw error;
				await this.logConflict(context, taskId, everWorksTaskId, `${name}_refused`, error.message, { details: error.details ?? null });
			}
		}
		return { task, version };
	}

	private async createInEverWorks(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		task: Task,
		actAs: string | null,
		change: EverWorksOutboundChange
	): Promise<EverWorksPushOutcome> {
		const out = await this.outgoing(context, task);
		if (out.wait !== undefined) return { status: 'deferred', message: out.wait, retryInMs: TASK_WAIT_MS };
		const connectionId = context.connection.id as ID;
		const wanted = everWorksStatusOf(task);
		const priority = gauzyPriorityToEverWorks(out.g.priority);
		const { title } = titleForEverWorks(task.title);
		const description = descriptionForEverWorks(out.g.description ?? '', task.title);
		const body = {
			title,
			...(description ? { description } : {}),
			status: createStatusFor(wanted),
			...(priority ? { priority } : {}),
			labels: out.labels,
			teamIds: out.teamIds,
			workId: out.workId,
			parentTaskId: out.parentTaskId,
			assignees: out.assignees,
			externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: task.id as ID }
		};
		const idempotencyKey = createHash('sha256').update(`${connectionId}:${EverWorksLinkType.TASK}:${task.id}:create`).digest('hex');
		// CR-2 (T17a): a create whose answer was lost may exist in Ever Works already; look it up before creating again.
		const recovered = (change.attempts ?? 0) > 0 ? await this.lookUpOwn(client, task.id as ID) : null;
		if (recovered) {
			// What it was created with is not known (Gauzy may have been edited since): it is linked with no Gauzy
			// side, so the update below sends every Gauzy value that differs from it.
			await this.record(context, task.id as ID, recovered, recovered.version ?? null, { g: {}, e: everWorksSideOf(recovered) }, 'outbound', {});
			const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, task.id as ID);
			if (link) return this.updateInEverWorks(context, client, task, link, actAs);
		}
		const created = await this.withActAs(actAs, (actor) =>
			client.request<EverWorksTask>('POST', '/tasks', {
				body,
				idempotencyKey: actor === actAs ? idempotencyKey : createHash('sha256').update(`${idempotencyKey}:no-act-as`).digest('hex'),
				actAsUserId: actor
			})
		);
		let dto = created;
		let g = out.g;
		if (wanted && wanted !== dto.status) {
			const moved = await this.transition(context, client, task, dto.id, wanted, actAs);
			dto = moved.task;
			if (moved.revertedTo !== undefined) g = { ...g, status: moved.revertedTo };
		}
		// Watchers, blockers and relations are sets of their own (not in the create body).
		const sets = {
			...(out.watchers.length ? { watchers: out.watchers } : {}),
			...(out.blockedBy.length ? { blockedBy: out.blockedBy } : {}),
			...(out.relations.length ? { relations: out.relations } : {})
		};
		if (Object.keys(sets).length) {
			const put = await this.putSets(context, client, task.id as ID, dto.id, sets, dto.version ?? undefined, actAs);
			dto = put.task ?? dto;
		}
		await this.record(context, task.id as ID, dto, dto.version ?? null, { g, e: everWorksSideOf(dto) }, 'outbound', {
			pendingWatchers: out.pendingWatchers,
			pendingEdges: out.pendingEdges
		});
		this.logger.log(`Gauzy task ${task.id} created in Ever Works as ${dto.id}.`);
		return { status: 'pushed', message: 'created in Ever Works' };
	}

	private async updateInEverWorks(context: EverWorksMappingContext, client: EverWorksClient, task: Task, link: EverWorksEntityLink, actAs: string | null): Promise<EverWorksPushOutcome> {
		let row = task;
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const out = await this.outgoing(context, row);
			if (out.wait !== undefined) return { status: 'deferred', message: out.wait, retryInMs: TASK_WAIT_MS };
			const snapshot = parseTaskSnapshot(this.links.snapshot<TaskSnapshot>(pair));
			const prevG = snapshot.g;
			const prevE = snapshot.e;
			const g = out.g;
			// A field with no Gauzy snapshot yet (a recovered create; a field added later) counts as changed: it is sent
			// when it differs from Ever Works.
			const changed = (field: keyof TaskGauzySide) => !(field in prevG) || !sameField(g[field], prevG[field]);
			const patch: Record<string, unknown> = {};
			if (changed('title') || changed('description')) {
				const { title, truncated } = titleForEverWorks(row.title);
				const description = descriptionForEverWorks(g.description ?? '', row.title);
				// The full-title line rides in the description: it changes with a long title, or when one starts or stops.
				const appendixChanged = changed('title') && (truncated || titleForEverWorks(prevG.title).truncated);
				if (changed('title') && title !== prevE.title) patch['title'] = title;
				if ((changed('description') || appendixChanged) && description !== (prevE.description ?? '')) patch['description'] = description || null;
			}
			if (changed('priority')) {
				const priority = gauzyPriorityToEverWorks(g.priority);
				if (priority && priority !== prevE.priority) patch['priority'] = priority;
			}
			if (changed('tags')) {
				const labels = labelsForEverWorks(applySetChange(prevE.labels ?? [], labelsForEverWorks(prevG.tags ?? []), out.labels, lower));
				if (!sameField(labels, prevE.labels)) patch['labels'] = labels;
			}
			if (changed('teamIds')) {
				const before = await this.everWorksTeamsOf(context, prevG.teamIds ?? []);
				const teamIds = applySetChange(prevE.teamIds ?? [], before, out.teamIds);
				if (!sameField(teamIds, prevE.teamIds)) patch['teamIds'] = teamIds;
			}
			if (changed('parentId') && out.parentTaskId !== (prevE.parentTaskId ?? null)) patch['parentTaskId'] = out.parentTaskId;
			if (changed('projectId') && out.workId !== (prevE.workId ?? null)) patch['workId'] = out.workId;
			let assignees: EverWorksPrincipalRef[] | null = null;
			if (changed('memberIds')) {
				const before: string[] = [];
				for (const employeeId of prevG.memberIds ?? []) {
					const ref = await this.principalFor(context, employeeId as ID);
					if (ref) before.push(principalKey(ref));
				}
				const keys = applySetChange(prevE.assignees ?? [], before, out.assignees.map(principalKey));
				if (!sameField(keys, prevE.assignees)) assignees = keys.map(principalOf).filter((ref): ref is EverWorksPrincipalRef => !!ref);
			}
			const wanted = changed('status') ? everWorksStatusOf(row) : null;
			const status = wanted && wanted !== prevE.status ? wanted : null;
			// Watchers and edges: Gauzy's change applied onto Ever Works' sets. What was pending at the last push
			// (no person or task link then) counts as added now, so it goes out once it can.
			const ewOnly = this.everWorksOnly(pair);
			const sets: { watchers?: string[]; blockedBy?: string[]; relations?: string[] } = {};
			const pendingWatchers = new Set(ewOnly.pendingWatchers ?? []);
			if (changed('watcherIds') || pendingWatchers.size) {
				const before: string[] = [];
				for (const employeeId of (prevG.watcherIds ?? []).filter((id) => !pendingWatchers.has(id))) {
					const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId as ID);
					if (person && person.state !== EverWorksLinkState.UNLINKED) before.push(person.ewId);
				}
				const watchers = applySetChange(prevE.watchers ?? [], before, out.watchers);
				if (!sameField(watchers, prevE.watchers)) sets.watchers = watchers;
			}
			const pendingEdges = new Set(ewOnly.pendingEdges ?? []);
			if (changed('blockedBy') || changed('relations') || pendingEdges.size) {
				const before: string[] = [];
				for (const key of [...(prevG.blockedBy ?? []).map((id) => `blocked:${id}`), ...(prevG.relations ?? [])].filter((k) => !pendingEdges.has(k))) {
					const edge = edgeOf(key);
					const other = edge ? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, edge.id as ID) : null;
					if (!edge || !other || other.state === EverWorksLinkState.UNLINKED) continue;
					before.push(edge.kind === 'blocked' ? `blocked:${other.ewId}` : `${edge.kind}:${other.ewId}`);
				}
				const after = [...out.blockedBy.map((id) => `blocked:${id}`), ...out.relations];
				const edges = applySetChange(edgeKeysOf(prevE), before, after, relationKey);
				const blockedBy = edges.filter((k) => k.startsWith('blocked:')).map((k) => k.slice('blocked:'.length));
				const relations = edges.filter((k) => !k.startsWith('blocked:'));
				if (!sameField(blockedBy, prevE.blockedBy)) sets.blockedBy = blockedBy;
				if (!sameField(relations, prevE.relations)) sets.relations = relations;
			}
			const pendingNow = { pendingWatchers: out.pendingWatchers, pendingEdges: out.pendingEdges };
			if (!Object.keys(patch).length && !assignees && !status && !Object.keys(sets).length) {
				// Nothing Ever Works can take (a custom status without flags, a member with no person link, …):
				// recorded, so the same difference is not looked at again.
				const fields = Object.keys(g) as Array<keyof TaskGauzySide>;
				if (!Object.keys(prevG).length || fields.some((field) => changed(field) || !(field in prevG)) || pendingWatchers.size || pendingEdges.size) {
					await this.record(context, row.id as ID, null, pair.ewVersion ?? null, { g, e: prevE }, 'outbound', pendingNow, pair);
				}
				return { status: 'skipped', message: 'nothing changed' };
			}
			try {
				let version = pair.ewVersion ?? undefined;
				let dto: EverWorksTask | null = null;
				let nextG = g;
				const ewTaskId = encodeURIComponent(pair.ewId);
				if (Object.keys(patch).length) {
					dto = await this.withActAs(actAs, (actor) =>
						client.request<EverWorksTask>('PATCH', `/tasks/${ewTaskId}`, { body: patch, ifMatchVersion: version, actAsUserId: actor })
					);
					version = dto?.version ?? version;
				}
				if (assignees) {
					dto = await this.withActAs(actAs, (actor) =>
						client.request<EverWorksTask>('PUT', `/tasks/${ewTaskId}/assignees`, { body: { assignees }, ifMatchVersion: version, actAsUserId: actor })
					);
					version = dto?.version ?? version;
				}
				if (Object.keys(sets).length) {
					const put = await this.putSets(context, client, row.id as ID, pair.ewId, sets, version, actAs);
					dto = put.task ?? dto;
					version = put.version;
				}
				if (status) {
					const moved = await this.transition(context, client, row, pair.ewId, status, actAs);
					dto = moved.task;
					if (moved.revertedTo !== undefined) nextG = { ...nextG, status: moved.revertedTo };
				}
				dto ??= await client.request<EverWorksTask>('GET', `/tasks/${ewTaskId}`);
				await this.record(context, row.id as ID, dto, dto.version ?? null, { g: nextG, e: everWorksSideOf(dto) }, 'outbound', pendingNow, pair);
				return { status: 'pushed' };
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				// 412: Ever Works moved on. When tasks sync from Ever Works its newer state is applied to Gauzy first
				// (as the sync, so it is not captured back), then this push is merged again on top of it (§C.3).
				const remote = await this.fetchTask(context, pair.ewId);
				if (!remote) return { status: 'skipped', message: 'the task is not visible in Ever Works any more' };
				if (fromEverWorks(context.directions.tasks)) {
					await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `task-412:${pair.ewId}` }, () =>
						this.applyTask(context, pair, remote, remote.version ?? null, { occurredAt: remote.updatedAt ?? new Date().toISOString(), actor: { type: 'system', id: null } }, 0)
					);
				} else {
					// One way (Gauzy → Ever Works): only Ever Works' state and version are recorded; the Gauzy snapshot
					// stays, so the retry sends Gauzy's changes since the last sync on top of Ever Works' current task.
					await this.record(context, row.id as ID, remote, remote.version ?? null, { g: prevG, e: everWorksSideOf(remote) }, 'outbound', null, pair);
				}
				const freshLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, row.id as ID);
				const freshTask = await this.store.load(context.tenantId, row.id as ID);
				if (!freshLink || freshLink.state === EverWorksLinkState.UNLINKED || !freshTask) return { status: 'skipped', message: 'the task changed during the push' };
				pair = freshLink;
				row = freshTask;
			}
		}
		throw new Error('unreachable');
	}

	/**
	 * `POST /tasks/:id/transition {to, mode:'sync'}` (EW-P1-6: shortest legal path, no agent work). On `409
	 * transition_blocked` Ever Works' gates win: Gauzy takes Ever Works' status back, as the sync, and a
	 * comment says why (plan 01 §7.1, plan 03 §C.3).
	 */
	private async transition(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		task: Task,
		everWorksTaskId: string,
		to: string,
		actAs: string | null
	): Promise<{ task: EverWorksTask; revertedTo?: string | null }> {
		const path = `/tasks/${encodeURIComponent(everWorksTaskId)}/transition`;
		try {
			const moved = await this.withActAs(actAs, (actor) => client.request<EverWorksTask>('POST', path, { body: { to, mode: 'sync' }, actAsUserId: actor }));
			return { task: moved };
		} catch (error) {
			if (!(error instanceof EverWorksApiError && error.status === 409 && error.code === 'transition_blocked')) throw error;
			const remote = (await this.fetchTask(context, everWorksTaskId)) as EverWorksTask;
			if (!remote) throw error;
			const target = everWorksStatusToGauzy(remote.status);
			let revertedTo: string | null = gauzyStatusSlug(task.taskStatus?.value ?? task.status) || null;
			await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `task-409:${everWorksTaskId}` }, async () => {
				if (target) {
					const option = await this.store.statusFor(this.scopeOf(context, task), remote.status, target.slug);
					await this.store.asActor(context, await this.adminActor(context), () =>
						this.store.update(task.id as ID, { status: option.value as never, taskStatusId: (option.id ?? null) as never })
					);
					revertedTo = gauzyStatusSlug(option.value) || null;
				}
				await this.store.addComment(context, task.id as ID, `<p>${escapeHtml(transitionBlockedMessage(remote.status, to, error.details))}</p>`, ActorTypeEnum.System);
			});
			await this.logConflict(context, task.id as ID, everWorksTaskId, 'conflict:resolved-by-ew', error.message, { wanted: to, kept: remote.status, details: error.details ?? null });
			return { task: remote, revertedTo };
		}
	}

	/**
	 * A Gauzy task deleted (plan 03 §C.3 delete policy, "archive/cancel"): Ever Works cancels it, with a
	 * comment, and the link stops syncing. Nothing is deleted in Ever Works.
	 */
	private async pushDelete(context: EverWorksMappingContext, link: EverWorksEntityLink | null, change: EverWorksOutboundChange): Promise<EverWorksPushOutcome> {
		if (!link) return { status: 'skipped', message: 'the task is not in Ever Works' };
		const client = this.client(context);
		const connectionId = context.connection.id as ID;
		const ewTaskId = encodeURIComponent(link.ewId);
		const snapshot = parseTaskSnapshot(this.links.snapshot<TaskSnapshot>(link));
		try {
			if (snapshot.e.status !== 'cancelled') {
				await client.request('POST', `/tasks/${ewTaskId}/transition`, { body: { to: 'cancelled', mode: 'sync' } }).catch((error: unknown) => {
					// A gate that refuses the cancel is logged; the comment still says the Gauzy task is gone.
					if (!(error instanceof EverWorksApiError && error.status === 409)) throw error;
				});
			}
			await client.request('POST', `/tasks/${ewTaskId}/comments`, {
				body: { body: 'This task was deleted in Ever Gauzy. It is cancelled here and no longer synced.', externalAuthor: { name: 'Ever Gauzy', source: EVER_WORKS_LINK_SOURCE } },
				idempotencyKey: createHash('sha256').update(`${connectionId}:${EverWorksLinkType.TASK}:${change.gauzyId}:deleted`).digest('hex')
			});
		} catch (error) {
			if (!(error instanceof EverWorksApiError && error.status === 404)) throw error;
		}
		await this.links.unlink(link, 'deleted in Gauzy; cancelled in Ever Works');
		return { status: 'pushed', message: 'cancelled in Ever Works (delete policy)' };
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The task sweep (plan 03 §C.2, the durable backstop), run by the sync loop for a connection it holds:
	 * watchers and linked issues are often removed with a bulk delete the ORM hooks cannot see, so a linked
	 * task whose watchers or edges drifted from its snapshot, or that has something pending that can go out
	 * now, is queued for a push.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contexts.forConnection(connection)) {
			if (!context.isEnabled || !toEverWorks(context.directions.tasks)) continue;
			const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TASK)).filter((link) => link.state === EverWorksLinkState.OK);
			for (let start = 0; start < links.length; start += TASK_SWEEP_PAGE) {
				const page = links.slice(start, start + TASK_SWEEP_PAGE);
				const ids = page.map((link) => link.gauzyId as ID);
				const [watchers, edges] = await Promise.all([this.store.watchersOf(context.tenantId, ids), this.store.edgesOf(context.tenantId, ids)]);
				for (const link of page) {
					const id = link.gauzyId as ID;
					const g = parseTaskSnapshot(this.links.snapshot<TaskSnapshot>(link)).g;
					const ewOnly = this.everWorksOnly(link);
					const edge = edges.get(id) ?? { blockedBy: [], relations: [] };
					const drifted = !sameField(watchers.get(id) ?? [], g.watcherIds) || !sameField(edge.blockedBy, g.blockedBy) || !sameField(edge.relations, g.relations);
					if (drifted || (await this.pendingResolvable(context, ewOnly))) {
						await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType: EverWorksLinkType.TASK, gauzyId: id, op: 'upsert' });
					}
				}
			}
		}
	}

	/** Whether a watcher or an edge that was pending at the last push has its person or task link now. */
	private async pendingResolvable(context: EverWorksMappingContext, ewOnly: TaskEverWorksOnly): Promise<boolean> {
		for (const employeeId of ewOnly.pendingWatchers ?? []) {
			const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId as ID);
			if (person && person.state !== EverWorksLinkState.UNLINKED) return true;
		}
		for (const key of ewOnly.pendingEdges ?? []) {
			const edge = edgeOf(key);
			const other = edge ? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TASK, edge.id as ID) : null;
			if (other && other.state !== EverWorksLinkState.UNLINKED) return true;
		}
		return false;
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	/** Runs a write with act-as; Ever Works refusing the act-as (`403 act_as_forbidden`) → once more without it (§C.3). */
	private async withActAs<T>(actAs: string | null, call: (actor: string | null) => Promise<T>): Promise<T> {
		try {
			return await call(actAs);
		} catch (error) {
			if (!actAs || !(error instanceof EverWorksApiError && error.status === 403 && error.code === 'act_as_forbidden')) throw error;
			this.logger.warn('Ever Works refused the act-as user; the write is attributed to the integration.');
			return call(null);
		}
	}

	/** The Ever Works user a Gauzy user writes as (`X-Act-As-User`), or `null` (attributed to the integration). */
	private async actAsFor(context: EverWorksMappingContext, userId: ID | null): Promise<string | null> {
		if (!userId) return null;
		const employeeId = await this.store.employeeOfUser(context.tenantId, context.organizationId, userId);
		if (!employeeId) return null;
		const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId);
		return person && person.state !== EverWorksLinkState.UNLINKED ? person.ewId : null;
	}

	/** The admin who connected Ever Works (the sync's own writes in Gauzy are attributed to them). */
	private async adminActor(context: EverWorksMappingContext): Promise<EverWorksTaskActor> {
		return { userId: (context.connection.connectedByUserId as ID) ?? null, name: 'Ever Works', agent: false, employeeId: null };
	}

	/** The Ever Works principal of a Gauzy employee (a linked person or agent), or `null`. */
	private async principalFor(context: EverWorksMappingContext, employeeId: ID): Promise<EverWorksPrincipalRef | null> {
		const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId);
		if (person && person.state !== EverWorksLinkState.UNLINKED) return { type: 'user', id: person.ewId };
		const agent = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.AGENT, employeeId);
		if (agent && agent.state !== EverWorksLinkState.UNLINKED) return { type: 'agent', id: agent.ewId };
		return null;
	}

	/** Gauzy teams of Ever Works team ids; the ones not linked (yet) are `unmapped`. */
	private async gauzyTeamsOf(context: EverWorksMappingContext, everWorksTeamIds: ReadonlyArray<string>): Promise<{ ids: ID[]; unmapped: string[] }> {
		const ids: ID[] = [];
		const unmapped: string[] = [];
		for (const ewTeamId of new Set(everWorksTeamIds)) {
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, ewTeamId);
			if (link && link.state !== EverWorksLinkState.UNLINKED) ids.push(link.gauzyId as ID);
			else unmapped.push(ewTeamId);
		}
		return { ids, unmapped };
	}

	/** Ever Works teams of Gauzy team ids (linked ones only). */
	private async everWorksTeamsOf(context: EverWorksMappingContext, gauzyTeamIds: ReadonlyArray<string>): Promise<string[]> {
		const ids: string[] = [];
		for (const teamId of new Set(gauzyTeamIds)) {
			const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, teamId as ID);
			if (link && link.state !== EverWorksLinkState.UNLINKED) ids.push(link.ewId);
		}
		return ids;
	}

	/** Gauzy employees of Ever Works assignees (`user:<id>` / `agent:<id>`); the ones not linked are `unmapped`. */
	private async gauzyMembersOf(context: EverWorksMappingContext, keys: ReadonlyArray<string>): Promise<{ ids: ID[]; unmapped: string[] }> {
		const ids: ID[] = [];
		const unmapped: string[] = [];
		for (const key of new Set(keys)) {
			const ref = principalOf(key);
			const type = ref?.type === 'agent' ? EverWorksLinkType.AGENT : EverWorksLinkType.MEMBER;
			const link = ref ? await this.links.byEw(context.integrationTenantId, type, ref.id) : null;
			if (link && link.state !== EverWorksLinkState.UNLINKED) ids.push(link.gauzyId as ID);
			else unmapped.push(key);
		}
		return { ids, unmapped };
	}

	private scopeOf(context: EverWorksMappingContext, task: Task): EverWorksTaskScope {
		return {
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			projectId: (task.projectId as ID) ?? null,
			teamId: ((task.teams ?? [])[0]?.id as ID) ?? null
		};
	}

	/** `GET /tasks/:id`, or `null` when Ever Works does not show it (gone, or private). */
	private async fetchTask(context: EverWorksMappingContext, everWorksTaskId: string): Promise<EverWorksTask | null> {
		try {
			return await this.client(context).request<EverWorksTask>('GET', `/tasks/${encodeURIComponent(everWorksTaskId)}`);
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) return null;
			throw error;
		}
	}

	/** The Ever Works task that already carries our external link for a Gauzy task, or `null`. */
	private async lookUpOwn(client: EverWorksClient, gauzyTaskId: ID): Promise<EverWorksTask | null> {
		try {
			const result = await client.request<EverWorksListPage<{ entityId: string; installationId?: string | null }> | Array<{ entityId: string }>>('GET', '/links', {
				query: { entityType: 'task', externalId: gauzyTaskId }
			});
			const rows = Array.isArray(result) ? result : (result?.data ?? []);
			const entityId = rows[0]?.entityId;
			if (!entityId) return null;
			return await client.request<EverWorksTask>('GET', `/tasks/${encodeURIComponent(entityId)}`);
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status < 500 && error.status !== 429) return null;
			throw error;
		}
	}

	/** Shows the Gauzy task on the Ever Works task (`PUT /links/task/:id`); best effort. */
	private async putExternalLink(context: EverWorksMappingContext, everWorksTaskId: string, taskId: ID): Promise<void> {
		try {
			await this.client(context).request('PUT', `/links/task/${encodeURIComponent(everWorksTaskId)}`, {
				body: { externalId: taskId, installationId: context.connection.id }
			});
		} catch (error) {
			this.logger.warn(`The Ever Works task ${everWorksTaskId} was not linked back to Gauzy (${error instanceof EverWorksApiError ? `${error.status} ${error.code}` : 'network'}).`);
		}
	}

	private async record(
		context: EverWorksMappingContext,
		taskId: ID,
		task: EverWorksTask | null,
		version: number | null,
		snapshot: TaskSnapshot,
		direction: 'inbound' | 'outbound',
		extras: Pick<TaskEverWorksOnly, 'unmappedTeams' | 'unmappedAssignees' | 'unmappedWatchers' | 'unmappedEdges' | 'pendingWatchers' | 'pendingEdges'> | null,
		previous?: EverWorksEntityLink
	): Promise<void> {
		const before = this.everWorksOnly(previous ?? null);
		const ewOnly: TaskEverWorksOnly = task
			? {
					slug: task.slug ?? before.slug ?? null,
					webUrl: task.webUrl ?? before.webUrl ?? null,
					missionId: task.missionId ?? null,
					ideaId: task.ideaId ?? null,
					goalId: task.goalId ?? null,
					agentId: task.agentId ?? null,
					visibility: task.visibility ?? before.visibility ?? null,
					visibilityExplicit: task.visibilityExplicit ?? before.visibilityExplicit ?? false,
					approvers: task.approvers ?? before.approvers ?? [],
					reviewers: task.reviewers ?? before.reviewers ?? [],
					runtime: task.runtime ?? before.runtime ?? null,
					hiddenFromBoard: task.hiddenFromBoard ?? before.hiddenFromBoard ?? false,
					unmappedTeams: extras?.unmappedTeams ?? before.unmappedTeams ?? [],
					unmappedAssignees: extras?.unmappedAssignees ?? before.unmappedAssignees ?? [],
					unmappedWatchers: extras?.unmappedWatchers ?? before.unmappedWatchers ?? [],
					unmappedEdges: extras?.unmappedEdges ?? before.unmappedEdges ?? [],
					pendingWatchers: extras?.pendingWatchers ?? before.pendingWatchers ?? [],
					pendingEdges: extras?.pendingEdges ?? before.pendingEdges ?? []
				}
			: { ...before, ...(extras?.pendingWatchers ? { pendingWatchers: extras.pendingWatchers } : {}), ...(extras?.pendingEdges ? { pendingEdges: extras.pendingEdges } : {}) };
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.TASK,
			gauzyId: taskId,
			ewId: task?.id ?? (previous?.ewId as string),
			ewVersion: version,
			...(task?.updatedAt ? { ewUpdatedAt: task.updatedAt } : {}),
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private everWorksOnly(link: EverWorksEntityLink | null | undefined): TaskEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as TaskEverWorksOnly;
		} catch {
			return {};
		}
	}

	private async logConflict(
		context: EverWorksMappingContext,
		taskId: ID,
		everWorksTaskId: string,
		action: string,
		message: string,
		details?: Record<string, unknown> | object
	): Promise<void> {
		await this.log
			.write({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'inbound',
				entityType: EverWorksLinkType.TASK,
				gauzyId: taskId,
				ewId: everWorksTaskId,
				action,
				status: 'conflict',
				message,
				details: (details as Record<string, unknown>) ?? null
			})
			.catch((error) => this.logger.warn(`A task conflict could not be logged (${error instanceof Error ? error.name : 'error'}).`));
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}
