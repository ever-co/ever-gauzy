import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, MoreThan, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationProject, OrganizationTeam, RequestContext, Task } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../../client/ever-works-client';
import type { EverWorksListPage } from '../../client/ever-works-client.types';
import { EverWorksConnection, EverWorksConnectionStatus } from '../../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../../connection/ever-works-connection.service';
import { EVER_WORKS_INTEGRATION_NAME } from '../../ever-works.constants';
import { EverWorksSettingName } from '../../ever-works-setting.enum';
import type { EverWorksDirection, EverWorksDomain } from '../../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksInboundEvent, EverWorksInboundStatus, EverWorksLinkState, EverWorksLinkType } from '../entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../ever-works-sync-log.service';
import type { EverWorksSyncSweeper } from '../ever-works-sync.loop';
import { describeSyncError } from '../ever-works-sync.loop';
import { EverWorksInboundApplier } from '../inbound/ever-works-inbound.applier';
import { EverWorksInboundStore } from '../inbound/ever-works-inbound.store';
import { EverWorksOutboundPusher } from '../outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../outbound/ever-works-outbound.queue';
import {
	COMMENTS_PER_TASK,
	COMMENTS_SEQ_BASE,
	EVER_WORKS_SYNC_PHASE_SPECS,
	EverWorksSyncPhaseName,
	EverWorksSyncPhaseSpec,
	fromEverWorks,
	initialCommentEnvelope,
	initialEnvelope,
	initialSeq,
	orderForImport,
	PHASE_MAX_PAGES,
	PREVIEW_MAX_PAGES,
	resolvePass,
	toEverWorks
} from './ever-works-sync-phases';
import { EverWorksSyncRun, EverWorksSyncRunMode, EverWorksSyncRunStatus } from './ever-works-sync-run.entity';

/** Where one phase of a run stands (the checkpoint). */
export interface EverWorksSyncPhaseState {
	name: EverWorksSyncPhaseName;
	/** `applying`: its records are queued and the applier is working through them. */
	status: 'pending' | 'importing' | 'applying' | 'done' | 'skipped' | 'failed';
	message?: string | null;
	/** Children phases: the last parent link processed (keyset). */
	cursor?: string | null;
	/** Initial events stored, already stored (the same snapshot), and Gauzy records queued for Ever Works. */
	queued: number;
	duplicates: number;
	exported: number;
	attempts: number;
	retryAt?: string | null;
	startedAt?: string | null;
	applyingSince?: string | null;
	finishedAt?: string | null;
}

/** A run as the API returns it. */
export interface EverWorksSyncRunView {
	id: ID;
	mode: EverWorksSyncRunMode;
	reason: string | null;
	status: EverWorksSyncRunStatus;
	feedHead: string | null;
	currentPhase: string | null;
	phases: EverWorksSyncPhaseState[];
	requestedByUserId: ID | null;
	startedAt: Date | null;
	finishedAt: Date | null;
	lastProgressAt: Date | null;
	lastError: string | null;
}

/** The dry run of one phase (plan 03 §C.6 step 2). */
export interface EverWorksSyncPhasePreview {
	phase: EverWorksSyncPhaseName;
	domain: EverWorksDomain;
	direction: EverWorksDirection;
	/** Whether this version runs the phase for this mapping (direction, handler, key scope, route). */
	supported: boolean;
	note: string | null;
	everWorks: { total: number; linked: number; truncated: boolean } | null;
	gauzy: { total: number; linked: number } | null;
	/** Records the run creates on each side. */
	creates: { inGauzy: number; inEverWorks: number };
	/** Records that are only paired on their tab (people, teams, works): never created by the run. */
	toPair: { everWorks: number; gauzy: number } | null;
}

export interface EverWorksSyncPreview {
	integrationTenantId: ID;
	generatedAt: Date;
	isEnabled: boolean;
	directions: Record<EverWorksDomain, EverWorksDirection>;
	phases: EverWorksSyncPhasePreview[];
}

/** How long one sweep of a connection advances its runs before it lets the loop move on. */
export const SYNC_RUN_BUDGET_MS = 20_000;
/** A phase is done once its records are applied, or after this long (the rest keeps retrying on its own). */
export const PHASE_SETTLE_MAX_MS = 30 * 60_000;
/** A phase that keeps failing (Ever Works unreachable) fails the run after this many attempts. */
export const PHASE_MAX_ATTEMPTS = 5;
/** Feed events replayed at most at the end of a run. */
export const REPLAY_MAX = 50_000;

const isOver = (deadline: number) => Date.now() >= deadline;

/**
 * Initial sync, resync and their dry run (plan 03 §C.6, plan 06 G-P1-10).
 *
 * - **Start** records the feed head (`whoami`), then a run per mapping (`ever_works_sync_run`).
 * - **Phases**, in order: members (mapping only), agents, teams, works, missions, goals, ideas, tasks
 *   (parents first), task edges (inside the task records), comments (the last 200 per synced task),
 *   inbox, docs. Each phase reads its list route in full and stores every record as an **initial
 *   event** (`receivedVia = 'initial'`), which the aggregate's handler applies like a live event: one
 *   writer per connection, version check, loop guard. A phase then queues the Gauzy records in scope
 *   for Ever Works where its direction writes there (teams: the paired ones; tasks: every task in
 *   scope; the pusher's snapshot diff makes unchanged ones no-ops). A phase waits until its records are
 *   applied before the next one starts, so dependencies (agents before tasks) are in place.
 * - **Checkpoints**: each phase's state is saved on the run as it moves; the sync loop advances the
 *   running run of each mapping under the connection's lease, so a run resumes in whichever process
 *   holds the connection after a restart. Storing is idempotent (event ids name the record and its
 *   version), so a phase cut short is simply read again.
 * - **Replay** (step 5): feed events after the head that were skipped meanwhile (e.g. an event for a
 *   team not paired yet) are applied again; anything at or below a link's version is skipped.
 * - **Resync**: the same run (a reconcile pass of every type). The feed's `410 cursor_expired` starts
 *   one on its own for every mapping of the connection.
 *
 * A phase whose handler is not part of this version (goals, missions, ideas, inbox, docs before their
 * items land) is `skipped` and picked up by the next resync. Nothing here deletes anything.
 */
@Injectable()
export class EverWorksInitialSyncService implements EverWorksSyncSweeper {
	/** Every tick: a running run advances as soon as the lease holder looks at its connection. */
	readonly sweepIntervalMs = 0;
	private readonly logger = new Logger('EverWorksInitialSync');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly inbound: EverWorksInboundStore,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly queue: EverWorksOutboundQueue,
		private readonly log: EverWorksSyncLogService
	) {}

	// ── Routes ─────────────────────────────────────────────────────────────────────────────────────

	/** `GET /mappings/:id/sync/preview`: per phase, what a run would read, pair and create. Writes nothing. */
	async preview(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksSyncPreview> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const client = this.client(context);
		const phases: EverWorksSyncPhasePreview[] = [];
		for (const spec of EVER_WORKS_SYNC_PHASE_SPECS) phases.push(await this.previewPhase(context, client, spec));
		return { integrationTenantId: context.integrationTenantId, generatedAt: new Date(), isEnabled: context.isEnabled, directions: context.directions, phases };
	}

	/** `POST /mappings/:id/sync/start` and `/sync/resync`: records the feed head and starts a run. */
	async start(integrationTenantId: ID, mode: EverWorksSyncRunMode, organizationId?: ID): Promise<EverWorksSyncRunView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		if (!context.isEnabled) throw new BadRequestException('The mapping is disabled; enable it before syncing.');
		if (context.connection.status !== EverWorksConnectionStatus.ACTIVE) {
			throw new BadRequestException(`The connection is ${context.connection.status}; resume it before syncing.`);
		}
		const run = await this.createRun(context, mode, 'admin', RequestContext.currentUserId() ?? null);
		return this.view(run);
	}

	/** `POST /mappings/:id/sync/cancel`: stops the running run (what it applied stays). */
	async cancel(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksSyncRunView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const run = await this.running(context.tenantId, context.integrationTenantId);
		if (!run) throw new NotFoundException('No sync is running for this mapping.');
		await this.finish(run, context, EverWorksSyncRunStatus.CANCELLED, 'cancelled by an admin');
		return this.view(run);
	}

	/** `GET /mappings/:id/sync/runs`: the latest runs, newest first. */
	async runs(integrationTenantId: ID, limit = 10, organizationId?: ID): Promise<EverWorksSyncRunView[]> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		return (await this.recent(context.tenantId, context.integrationTenantId, Math.min(Math.max(limit, 1), 50))).map((run) => this.view(run));
	}

	/** The latest runs of a mapping (for the status route). */
	recent(tenantId: ID, integrationTenantId: ID, limit: number): Promise<EverWorksSyncRun[]> {
		return this.dataSource.getRepository(EverWorksSyncRun).find({
			where: { tenantId, integrationTenantId } as never,
			order: { createdAt: 'DESC' } as never,
			take: limit
		});
	}

	// ── Sync loop ──────────────────────────────────────────────────────────────────────────────────

	/**
	 * Run by the sync loop for a connection it holds: starts the resync a `410 cursor_expired` asked for,
	 * then advances the running run of each mapping of the connection, within {@link SYNC_RUN_BUDGET_MS}.
	 */
	async sweep(connection: EverWorksConnection, stillOwner?: () => Promise<boolean>): Promise<void> {
		const deadline = Date.now() + SYNC_RUN_BUDGET_MS;
		const contexts = await this.contextsOf(connection);
		if (connection.resyncRequestedAt) await this.startRequestedResyncs(connection, contexts);
		for (const context of contexts) {
			if (isOver(deadline) || (stillOwner && !(await stillOwner()))) return;
			const run = await this.running(context.tenantId, context.integrationTenantId);
			if (!run || run.connectionId !== connection.id) continue;
			if (!context.isEnabled) {
				await this.finish(run, context, EverWorksSyncRunStatus.CANCELLED, 'the mapping was disabled');
				continue;
			}
			await this.advance(run, context, deadline, stillOwner).catch(async (error) => {
				this.logger.warn(`Mapping ${context.integrationTenantId}: the sync run could not advance (${describeSyncError(error)}).`);
				run.lastError = describeSyncError(error);
				await this.save(run).catch(() => undefined);
			});
		}
	}

	/** The feed's cursor expired (410): a resync for every enabled mapping without a running run. */
	private async startRequestedResyncs(connection: EverWorksConnection, contexts: EverWorksMappingContext[]): Promise<void> {
		const requestedAt = new Date(connection.resyncRequestedAt as Date);
		for (const context of contexts) {
			if (!context.isEnabled || (await this.running(context.tenantId, context.integrationTenantId))) continue;
			try {
				await this.createRun(context, 'resync', 'cursor_expired', null);
			} catch (error) {
				if (error instanceof ConflictException) continue; // another process started it
				this.logger.warn(`Mapping ${context.integrationTenantId}: the requested resync could not start (${describeSyncError(error)}).`);
				return; // the request stays; the next tick tries again
			}
		}
		// Cleared only if no newer request arrived meanwhile.
		await this.dataSource
			.getRepository(EverWorksConnection)
			.update({ id: connection.id, resyncRequestedAt: requestedAt } as never, { resyncRequestedAt: null } as never);
	}

	/** Moves a run on: the phases in order (one waits for the previous one), then the replay. */
	private async advance(run: EverWorksSyncRun, context: EverWorksMappingContext, deadline: number, stillOwner?: () => Promise<boolean>): Promise<void> {
		const phases = this.phasesOf(run);
		for (const state of phases) {
			if (['done', 'skipped'].includes(state.status)) continue;
			if (isOver(deadline) || (stillOwner && !(await stillOwner()))) return;
			const spec = EVER_WORKS_SYNC_PHASE_SPECS.find((candidate) => candidate.name === state.name);
			if (!spec) {
				// A phase this version does not know (a checkpoint written by another version): nothing to run.
				Object.assign(state, { status: 'skipped', message: 'unknown phase' });
				continue;
			}
			run.currentPhase = state.name;
			if (state.status === 'failed') {
				await this.finish(run, context, EverWorksSyncRunStatus.FAILED, `phase ${state.name}: ${state.message ?? 'failed'}`, phases);
				return;
			}
			if (state.retryAt && Date.parse(state.retryAt) > Date.now()) return; // backing off
			await this.step(state, spec, context, run, deadline, stillOwner);
			await this.save(run, phases);
			// `step` moved the state on (the narrowing above does not see it).
			const outcome = state.status as EverWorksSyncPhaseState['status'];
			if (outcome !== 'done' && outcome !== 'skipped') {
				if (outcome === 'failed') await this.finish(run, context, EverWorksSyncRunStatus.FAILED, `phase ${state.name}: ${state.message ?? 'failed'}`, phases);
				return; // the next phase waits for this one
			}
		}
		const replayed = await this.replay(run, context);
		await this.finish(run, context, EverWorksSyncRunStatus.DONE, null, phases, replayed);
	}

	/** One step of one phase; updates `state` in place. */
	private async step(
		state: EverWorksSyncPhaseState,
		spec: EverWorksSyncPhaseSpec,
		context: EverWorksMappingContext,
		run: EverWorksSyncRun,
		deadline: number,
		stillOwner?: () => Promise<boolean>
	): Promise<void> {
		const now = new Date();
		state.startedAt ??= now.toISOString();
		if (state.status === 'applying') {
			const waiting = await this.waitingInitialEvents(context, spec);
			const since = state.applyingSince ? Date.parse(state.applyingSince) : now.getTime();
			if (waiting === 0 || now.getTime() - since > PHASE_SETTLE_MAX_MS) {
				state.status = 'done';
				state.finishedAt = now.toISOString();
				if (waiting) state.message = `${waiting} records are still waiting; they keep retrying on their own`;
			}
			return;
		}
		const plan = this.planOf(spec, context);
		if (!plan.import && !plan.export) {
			Object.assign(state, { status: plan.done ? 'done' : 'skipped', message: plan.note, finishedAt: now.toISOString() });
			return;
		}
		state.status = 'importing';
		try {
			if (plan.import) {
				if (spec.kind === 'children') {
					const result = await this.importComments(context, state.cursor ?? null, deadline, stillOwner);
					state.queued += result.queued;
					state.duplicates += result.duplicates;
					state.cursor = result.cursor;
					if (!result.done) return; // carries on at the next sweep
				} else {
					const result = await this.importList(context, spec, run, stillOwner);
					if ('skip' in result) {
						Object.assign(state, { status: 'skipped', message: result.skip, finishedAt: now.toISOString() });
						return;
					}
					state.queued += result.queued;
					state.duplicates += result.duplicates;
				}
			}
			if (plan.export) state.exported += await this.exportPhase(context, spec, stillOwner);
			state.attempts = 0;
			state.retryAt = null;
			state.message = plan.note;
			if (state.queued > 0) {
				state.status = 'applying';
				state.applyingSince = new Date().toISOString();
			} else {
				state.status = 'done';
				state.finishedAt = new Date().toISOString();
			}
		} catch (error) {
			state.attempts += 1;
			state.message = describeSyncError(error);
			if (state.attempts >= PHASE_MAX_ATTEMPTS) {
				state.status = 'failed';
				return;
			}
			const backoff = Math.min(10 * 60_000, 30_000 * 2 ** (state.attempts - 1));
			state.retryAt = new Date(Date.now() + backoff).toISOString();
		}
	}

	/** What a phase does for a mapping: import (EW → G), export (G → EW), or nothing (and why). */
	private planOf(spec: EverWorksSyncPhaseSpec, context: EverWorksMappingContext): { import: boolean; export: boolean; done?: boolean; note: string | null } {
		const direction = context.directions[spec.domain];
		if (direction === 'off') return { import: false, export: false, note: `${spec.domain} are not synced for this mapping` };
		if (spec.kind === 'mapping_only') return { import: false, export: false, done: true, note: 'people are paired on the People tab; nobody is created' };
		if (spec.kind === 'included') return { import: false, export: false, done: true, note: 'carried by the task records' };
		const missingScope = spec.scope && !this.scopesOf(context.connection).includes(spec.scope);
		if (missingScope) return { import: false, export: false, note: `the Ever Works key lacks ${spec.scope}` };
		// Works are link only: the import refreshes paired projects from Ever Works.
		const reads = fromEverWorks(direction) || direction === 'link_only';
		const canImport = reads && !!spec.aggregateType && this.applier.hasHandler(spec.aggregateType);
		const canExport = toEverWorks(direction) && !!spec.linkType && this.pusher.hasHandler(spec.linkType) && EXPORTED_PHASES.has(spec.name);
		if (!canImport && !canExport) return { import: false, export: false, note: 'not synced by this version yet; a later resync picks it up' };
		const note = spec.name === 'teams' || spec.name === 'works' ? 'unpaired records wait for their tab; only pairs are refreshed' : null;
		return { import: canImport, export: canExport, note };
	}

	// ── Import (EW → G) ────────────────────────────────────────────────────────────────────────────

	/** Reads a list route in full and stores every record as an initial event, parents first. */
	private async importList(
		context: EverWorksMappingContext,
		spec: EverWorksSyncPhaseSpec,
		run: EverWorksSyncRun,
		stillOwner?: () => Promise<boolean>
	): Promise<{ queued: number; duplicates: number } | { skip: string }> {
		const client = this.client(context);
		const records = new Map<string, Record<string, unknown>>();
		for (const pass of spec.list?.passes ?? [{}]) {
			const listed = await this.listAll(client, spec, resolvePass(pass, new Date()), PHASE_MAX_PAGES, stillOwner);
			if ('skip' in listed) return listed;
			for (const record of listed.records) if (typeof record['id'] === 'string') records.set(record['id'] as string, record);
		}
		const ordered = orderForImport([...records.values()], spec.parentField);
		const totals = { queued: 0, duplicates: 0 };
		let index = 0;
		let previousDepth = -1;
		for (const { record, depth } of ordered) {
			if (depth !== previousDepth) {
				index = 0;
				previousDepth = depth;
			}
			if (index % 200 === 0 && stillOwner && !(await stillOwner())) throw new Error('the sync lease moved to another process');
			const envelope = initialEnvelope({
				aggregateType: spec.aggregateType as string,
				record,
				seq: initialSeq(depth, index++),
				tenantId: context.connection.ewTenantId,
				organizationId: context.everWorksOrganizationId
			});
			const { duplicate } = await this.inbound.record(context.connection, envelope, 'initial');
			if (duplicate) totals.duplicates++;
			else totals.queued++;
		}
		this.logger.log(`Mapping ${context.integrationTenantId} (run ${run.id}): ${spec.name}: ${totals.queued} queued, ${totals.duplicates} already stored.`);
		return totals;
	}

	/** Every record of a list route (all pages, at most `maxPages`); a route this Ever Works does not serve skips the phase. */
	private async listAll(
		client: EverWorksClient,
		spec: EverWorksSyncPhaseSpec,
		query: Record<string, string>,
		maxPages: number,
		stillOwner?: () => Promise<boolean>
	): Promise<{ records: Array<Record<string, unknown>>; truncated: boolean } | { skip: string }> {
		const records: Array<Record<string, unknown>> = [];
		let cursor: string | null = null;
		try {
			for (let page = 0; page < maxPages; page++) {
				if (page > 0 && page % 10 === 0 && stillOwner && !(await stillOwner())) throw new Error('the sync lease moved to another process');
				const result: EverWorksListPage<Record<string, unknown>> = await client.request('GET', spec.list?.path as string, {
					query: { ...query, limit: 500, cursor }
				});
				records.push(...(result.data ?? []));
				if (!result.hasMore || !result.nextCursor) return { records, truncated: false };
				cursor = result.nextCursor;
			}
			return { records, truncated: true };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) return { skip: 'this Ever Works does not serve it yet; a later resync picks it up' };
			if (error instanceof EverWorksApiError && error.status === 403) return { skip: `Ever Works refused the list (${error.code})` };
			throw error;
		}
	}

	/**
	 * The comments of the synced tasks (the last {@link COMMENTS_PER_TASK} each), as initial
	 * `task.comment.created` events on their task, after every task event. Resumable by task link.
	 */
	private async importComments(
		context: EverWorksMappingContext,
		cursor: string | null,
		deadline: number,
		stillOwner?: () => Promise<boolean>
	): Promise<{ queued: number; duplicates: number; cursor: string | null; done: boolean }> {
		const client = this.client(context);
		const totals = { queued: 0, duplicates: 0 };
		let after = cursor;
		let index = 0;
		for (;;) {
			const links = await this.dataSource.getRepository(EverWorksEntityLink).find({
				where: {
					integrationTenantId: context.integrationTenantId,
					entityType: EverWorksLinkType.TASK,
					state: Not(EverWorksLinkState.UNLINKED),
					...(after ? { id: MoreThan(after) } : {})
				} as never,
				order: { id: 'ASC' } as never,
				take: 100
			});
			if (!links.length) return { ...totals, cursor: after, done: true };
			for (const link of links) {
				if (isOver(deadline) || (stillOwner && !(await stillOwner()))) return { ...totals, cursor: after, done: false };
				const comments = await this.lastComments(client, link.ewId);
				for (const comment of comments) {
					const envelope = initialCommentEnvelope({
						taskId: link.ewId,
						taskVersion: link.ewVersion ?? null,
						comment,
						seq: String(COMMENTS_SEQ_BASE + index++),
						tenantId: context.connection.ewTenantId,
						organizationId: context.everWorksOrganizationId
					});
					const { duplicate } = await this.inbound.record(context.connection, envelope, 'initial');
					if (duplicate) totals.duplicates++;
					else totals.queued++;
				}
				after = link.id as string;
			}
		}
	}

	/** The newest comments of one Ever Works task (list order is oldest first: the tail is kept). */
	private async lastComments(client: EverWorksClient, ewTaskId: string): Promise<Array<Record<string, unknown>>> {
		const comments: Array<Record<string, unknown>> = [];
		let cursor: string | null = null;
		try {
			for (let page = 0; page < 20; page++) {
				const result: EverWorksListPage<Record<string, unknown>> = await client.request('GET', `/tasks/${encodeURIComponent(ewTaskId)}/comments`, {
					query: { limit: COMMENTS_PER_TASK, cursor }
				});
				comments.push(...(result.data ?? []));
				if (comments.length > COMMENTS_PER_TASK) comments.splice(0, comments.length - COMMENTS_PER_TASK);
				if (!result.hasMore || !result.nextCursor) break;
				cursor = result.nextCursor;
			}
		} catch (error) {
			// A task deleted or turned private since it was linked has no comments to read.
			if (error instanceof EverWorksApiError && error.status === 404) return [];
			throw error;
		}
		return comments.filter((comment) => typeof comment['id'] === 'string' && comment['deleted'] !== true);
	}

	// ── Export (G → EW) ────────────────────────────────────────────────────────────────────────────

	/**
	 * Queues the Gauzy records of a phase for Ever Works (the pusher recomputes and diffs each one):
	 * paired teams (unpaired ones are paired or created on the Teams tab), and every task in scope.
	 */
	private async exportPhase(context: EverWorksMappingContext, spec: EverWorksSyncPhaseSpec, stillOwner?: () => Promise<boolean>): Promise<number> {
		const ids =
			spec.name === 'teams'
				? (await this.links(context, EverWorksLinkType.TEAM)).map((link) => link.gauzyId as ID)
				: spec.name === 'tasks'
					? await this.tasksInScope(context)
					: [];
		let queued = 0;
		for (const [index, gauzyId] of ids.entries()) {
			if (index % 200 === 199 && stillOwner && !(await stillOwner())) throw new Error('the sync lease moved to another process');
			const entityType = spec.linkType as EverWorksLinkType;
			if (await this.queue.enqueue({ tenantId: context.tenantId, organizationId: context.organizationId, entityType, gauzyId, op: 'upsert' })) queued++;
		}
		return queued;
	}

	/** The tasks the sync covers: of the organization, in a project paired with a work unless unpaired projects sync too (default). */
	private async tasksInScope(context: EverWorksMappingContext, max = 100_000): Promise<ID[]> {
		const syncUnlinked = this.setting(context.mapping, EverWorksSettingName.SYNC_UNLINKED_PROJECT_TASKS) !== 'false';
		const projectIds = syncUnlinked ? null : (await this.links(context, EverWorksLinkType.PROJECT_WORK)).map((link) => link.gauzyId as ID);
		if (projectIds && !projectIds.length) return [];
		const ids: ID[] = [];
		let after: string | null = null;
		while (ids.length < max) {
			const rows: Task[] = await this.dataSource.getRepository(Task).find({
				select: { id: true } as never,
				where: {
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					...(projectIds ? { projectId: In(projectIds) } : {}),
					...(after ? { id: MoreThan(after) } : {})
				} as never,
				order: { id: 'ASC' } as never,
				take: 1000
			});
			if (!rows.length) break;
			ids.push(...rows.map((row) => row.id as ID));
			after = rows[rows.length - 1].id as string;
		}
		return ids;
	}

	// ── Replay, runs ───────────────────────────────────────────────────────────────────────────────

	/**
	 * Step 5: feed and webhook events after the run's head that were skipped meanwhile (a record not
	 * paired yet, say) are applied again. Idempotent: what a link's version already covers is skipped.
	 */
	private async replay(run: EverWorksSyncRun, context: EverWorksMappingContext): Promise<number> {
		if (!run.feedHead) return 0;
		const repository = this.dataSource.getRepository(EverWorksInboundEvent);
		const ids = (
			await repository.find({
				select: { id: true } as never,
				where: {
					connectionId: context.connection.id as ID,
					organizationId: context.organizationId,
					receivedVia: In(['webhook', 'feed']),
					status: EverWorksInboundStatus.SKIPPED,
					error: Not('own origin'),
					seq: MoreThan(run.feedHead)
				} as never,
				order: { seq: 'ASC' } as never,
				take: REPLAY_MAX
			})
		).map((row) => row.id as ID);
		for (let i = 0; i < ids.length; i += 500) {
			await repository.update({ id: In(ids.slice(i, i + 500)), status: EverWorksInboundStatus.SKIPPED } as never, {
				status: EverWorksInboundStatus.PENDING,
				availableAt: new Date()
			} as never);
		}
		return ids.length;
	}

	/** Starts a run (one running run per mapping), with the feed head of now. */
	private async createRun(context: EverWorksMappingContext, mode: EverWorksSyncRunMode, reason: string, userId: ID | null): Promise<EverWorksSyncRun> {
		let feedHead: string;
		try {
			feedHead = String((await this.connections.client(context.connection).whoami()).feedHead ?? '0');
		} catch (error) {
			throw new BadGatewayException(`Ever Works did not answer (${describeSyncError(error)}); nothing was started.`);
		}
		const phases: EverWorksSyncPhaseState[] = EVER_WORKS_SYNC_PHASE_SPECS.map((spec) => ({
			name: spec.name,
			status: 'pending',
			queued: 0,
			duplicates: 0,
			exported: 0,
			attempts: 0
		}));
		const run = await this.dataSource.transaction(async (manager) => {
			await this.lockMapping(manager, context.integrationTenantId);
			const repository = manager.getRepository(EverWorksSyncRun);
			const running = await repository.findOne({
				where: { tenantId: context.tenantId, integrationTenantId: context.integrationTenantId, status: EverWorksSyncRunStatus.RUNNING } as never
			});
			if (running) throw new ConflictException('A sync is already running for this mapping.');
			const row = {
				id: randomUUID(),
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				mode,
				reason,
				status: EverWorksSyncRunStatus.RUNNING,
				feedHead,
				currentPhase: phases[0].name,
				phases: JSON.stringify(phases),
				requestedByUserId: userId,
				startedAt: new Date(),
				lastProgressAt: new Date()
			};
			try {
				await repository.insert(row as never);
			} catch (error) {
				// The partial unique index (Postgres, SQLite) caught a run another process started meanwhile.
				if (await repository.count({ where: { integrationTenantId: context.integrationTenantId, status: EverWorksSyncRunStatus.RUNNING } as never })) {
					throw new ConflictException('A sync is already running for this mapping.');
				}
				throw error;
			}
			return row as unknown as EverWorksSyncRun;
		});
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'system',
			action: mode === 'initial' ? 'initial_sync_started' : 'resync_started',
			status: 'ok',
			message: `${mode === 'initial' ? 'Initial sync' : 'Resync'} started (${reason}) at feed position ${feedHead}.`,
			details: { runId: run.id, feedHead, reason }
		});
		this.logger.log(`Mapping ${context.integrationTenantId}: ${mode} run ${run.id} started (${reason}, feed head ${feedHead}).`);
		return run;
	}

	/**
	 * Ends a running run (an admin's cancel and the loop's last step can meet: only the first one counts)
	 * and logs it. `replayed` is the number of feed events applied again (step 5), kept in the log entry.
	 */
	private async finish(
		run: EverWorksSyncRun,
		context: EverWorksMappingContext,
		status: EverWorksSyncRunStatus,
		error: string | null,
		phases?: EverWorksSyncPhaseState[],
		replayed?: number
	): Promise<void> {
		const finishedAt = new Date();
		const currentPhase = status === EverWorksSyncRunStatus.DONE ? null : (run.currentPhase ?? null);
		const result = await this.dataSource.getRepository(EverWorksSyncRun).update(
			{ id: run.id, status: EverWorksSyncRunStatus.RUNNING } as never,
			{ status, finishedAt, lastError: error, currentPhase, lastProgressAt: finishedAt, ...(phases ? { phases: JSON.stringify(phases) } : {}) } as never
		);
		if (!result.affected) return;
		Object.assign(run, { status, finishedAt, lastError: error, currentPhase, ...(phases ? { phases: JSON.stringify(phases) } : {}) });
		const label = run.mode === 'initial' ? 'Initial sync' : 'Resync';
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'system',
			action: `${run.mode === 'initial' ? 'initial_sync' : 'resync'}_${status}`,
			status: status === EverWorksSyncRunStatus.FAILED ? 'error' : status === EverWorksSyncRunStatus.CANCELLED ? 'skipped' : 'ok',
			message:
				status === EverWorksSyncRunStatus.DONE
					? `${label} finished${replayed ? `; ${replayed} feed events were applied again` : ''}.`
					: `${label} ${status}${error ? `: ${error}` : ''}.`,
			details: { runId: run.id, ...(replayed !== undefined ? { replayed } : {}) }
		});
	}

	/** Saves a run's progress (only while it is still running). */
	private async save(run: EverWorksSyncRun, phases?: EverWorksSyncPhaseState[]): Promise<void> {
		if (phases) run.phases = JSON.stringify(phases);
		await this.dataSource.getRepository(EverWorksSyncRun).update(
			{ id: run.id, status: EverWorksSyncRunStatus.RUNNING } as never,
			{ phases: run.phases, currentPhase: run.currentPhase ?? null, lastProgressAt: new Date(), lastError: run.lastError ?? null } as never
		);
	}

	running(tenantId: ID, integrationTenantId: ID): Promise<EverWorksSyncRun | null> {
		return this.dataSource.getRepository(EverWorksSyncRun).findOne({
			where: { tenantId, integrationTenantId, status: EverWorksSyncRunStatus.RUNNING } as never
		});
	}

	/** A run as the API returns it. */
	view(run: EverWorksSyncRun): EverWorksSyncRunView {
		return {
			id: run.id as ID,
			mode: run.mode,
			reason: run.reason ?? null,
			status: run.status,
			feedHead: run.feedHead ?? null,
			currentPhase: run.currentPhase ?? null,
			phases: this.phasesOf(run),
			requestedByUserId: (run.requestedByUserId as ID) ?? null,
			startedAt: run.startedAt ?? null,
			finishedAt: run.finishedAt ?? null,
			lastProgressAt: run.lastProgressAt ?? null,
			lastError: run.lastError ?? null
		};
	}

	private phasesOf(run: EverWorksSyncRun): EverWorksSyncPhaseState[] {
		try {
			const parsed = JSON.parse(run.phases || '[]') as EverWorksSyncPhaseState[];
			if (Array.isArray(parsed) && parsed.length) return parsed;
		} catch {
			// fall through: a fresh phase list
		}
		return EVER_WORKS_SYNC_PHASE_SPECS.map((spec) => ({ name: spec.name, status: 'pending', queued: 0, duplicates: 0, exported: 0, attempts: 0 }));
	}

	// ── Dry run ────────────────────────────────────────────────────────────────────────────────────

	private async previewPhase(context: EverWorksMappingContext, client: EverWorksClient, spec: EverWorksSyncPhaseSpec): Promise<EverWorksSyncPhasePreview> {
		const direction = context.directions[spec.domain];
		const plan = this.planOf(spec, context);
		const preview: EverWorksSyncPhasePreview = {
			phase: spec.name,
			domain: spec.domain,
			direction,
			supported: plan.import || plan.export || !!plan.done,
			note: plan.note,
			everWorks: null,
			gauzy: null,
			creates: { inGauzy: 0, inEverWorks: 0 },
			toPair: null
		};
		if (direction === 'off' || spec.kind === 'included' || spec.kind === 'children' || !spec.list) {
			if (spec.kind === 'children') preview.note = plan.import ? `the last ${COMMENTS_PER_TASK} comments of each synced task` : plan.note;
			return preview;
		}
		if (spec.scope && !this.scopesOf(context.connection).includes(spec.scope)) return preview;
		// Members are read for their counts even though nothing is imported (people are paired, never created).
		const counted = plan.import || plan.export || spec.kind === 'mapping_only';
		if (!counted) return preview;
		const listed = await this.listAll(client, spec, resolvePass(spec.list.passes?.[0] ?? {}, new Date()), PREVIEW_MAX_PAGES);
		if ('skip' in listed) {
			return { ...preview, supported: false, note: listed.skip };
		}
		const records = listed.records.filter((record) => record['deleted'] !== true && record['visibility'] !== 'private');
		const idOf = (record: Record<string, unknown>) => String(spec.name === 'members' ? (record['userId'] ?? record['id']) : record['id']);
		const links = spec.linkType ? await this.links(context, spec.linkType) : [];
		const linkedEw = new Set(links.map((link) => link.ewId));
		const linkedCount = records.filter((record) => linkedEw.has(idOf(record))).length;
		const unlinked = records.length - linkedCount;
		preview.everWorks = { total: records.length, linked: linkedCount, truncated: listed.truncated };
		if (spec.name === 'members') {
			preview.toPair = { everWorks: unlinked, gauzy: 0 };
			return preview;
		}
		if (spec.name === 'teams' || spec.name === 'works') {
			const gauzyTotal =
				spec.name === 'teams'
					? await this.dataSource.getRepository(OrganizationTeam).count({ where: { tenantId: context.tenantId, organizationId: context.organizationId, isArchived: false } as never })
					: await this.dataSource.getRepository(OrganizationProject).count({ where: { tenantId: context.tenantId, organizationId: context.organizationId, isArchived: false } as never });
			const linkedGauzy = links.length;
			preview.gauzy = { total: gauzyTotal, linked: linkedGauzy };
			preview.toPair = { everWorks: unlinked, gauzy: Math.max(0, gauzyTotal - linkedGauzy) };
			return preview;
		}
		if (plan.import) preview.creates.inGauzy = unlinked;
		if (spec.name === 'tasks') {
			const inScope = await this.tasksInScope(context);
			const linkedGauzy = new Set(links.map((link) => link.gauzyId));
			const linkedInScope = inScope.filter((id) => linkedGauzy.has(id)).length;
			preview.gauzy = { total: inScope.length, linked: linkedInScope };
			if (plan.export) preview.creates.inEverWorks = inScope.length - linkedInScope;
		}
		return preview;
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	/** Initial events of a phase's aggregate that are still to apply (pending, or failed and retrying). */
	private waitingInitialEvents(context: EverWorksMappingContext, spec: EverWorksSyncPhaseSpec): Promise<number> {
		if (!spec.aggregateType) return Promise.resolve(0);
		return this.dataSource.getRepository(EverWorksInboundEvent).count({
			where: {
				connectionId: context.connection.id as ID,
				organizationId: context.organizationId,
				receivedVia: 'initial',
				aggregateType: spec.aggregateType,
				status: In([EverWorksInboundStatus.PENDING, EverWorksInboundStatus.FAILED])
			} as never
		});
	}

	private links(context: EverWorksMappingContext, entityType: EverWorksLinkType): Promise<EverWorksEntityLink[]> {
		return this.dataSource.getRepository(EverWorksEntityLink).find({
			where: { integrationTenantId: context.integrationTenantId, entityType, state: Not(EverWorksLinkState.UNLINKED) } as never
		});
	}

	/** The mappings that sync through a connection. */
	private async contextsOf(connection: EverWorksConnection): Promise<EverWorksMappingContext[]> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false } as never,
			relations: { settings: true } as never
		});
		const contexts: EverWorksMappingContext[] = [];
		for (const mapping of mappings) {
			if (this.setting(mapping, EverWorksSettingName.CONNECTION_ID) !== connection.id) continue;
			const context = await this.contexts.forEverWorksOrganization(connection, this.setting(mapping, EverWorksSettingName.EVER_WORKS_ORGANIZATION_ID));
			if (context && context.integrationTenantId === mapping.id) contexts.push(context);
		}
		return contexts;
	}

	/** Serialises run creation per mapping (Postgres advisory lock, MySQL row lock; SQLite has one writer). */
	private async lockMapping(manager: EntityManager, integrationTenantId: ID): Promise<void> {
		const type = manager.connection.options.type;
		if (type === 'postgres') {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ever-works:sync-run:${integrationTenantId}`]);
		} else if (type === 'mysql' || type === 'mariadb') {
			await manager.findOne(IntegrationTenant, { where: { id: integrationTenantId } as never, lock: { mode: 'pessimistic_write' } });
		}
	}

	private scopesOf(connection: EverWorksConnection): string[] {
		try {
			const scopes = JSON.parse(connection.scopes || '[]');
			return Array.isArray(scopes) ? scopes.filter((scope) => typeof scope === 'string') : [];
		} catch {
			return [];
		}
	}

	private setting(mapping: IntegrationTenant, name: EverWorksSettingName): string {
		return mapping.settings?.find((s) => s.settingsName === name)?.settingsValue ?? '';
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}

/** Phases that queue Gauzy records for Ever Works (the others are one way, link only, or wait for their items). */
const EXPORTED_PHASES = new Set<EverWorksSyncPhaseName>(['teams', 'tasks']);
