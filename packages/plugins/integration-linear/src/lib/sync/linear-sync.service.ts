import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In, IsNull } from 'typeorm';
import { ID, IIntegrationMap, IIntegrationTenant, IntegrationEntity, isTaskSyncAllowed, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import {
	EmployeeService,
	IntegrationMap,
	IntegrationMapService,
	IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand,
	IntegrationTenantSyncService,
	Task,
	TaskPriority,
	TaskStatus,
	TaskUpdateCommand
} from '@gauzy/core';
import { LinearApiClient, LinearApiError, LinearIssue, LinearLabel, LinearStateType, LinearWorkflowState } from '../client/linear-api.client';
import { LinearSyncRun } from '../entities/linear-sync-run.entity';
import { LinearTeamMapping } from '../entities/linear-team-mapping.entity';
import { LinearConfig } from '../linear-config';
import { LinearMappingService } from '../linear-mapping.service';
import { linearSyncUser, runInLinearContext } from '../linear-process';
import { emptyCounts, LinearSyncCounts, LinearSyncRunService } from '../linear-sync-run.service';
import { LinearTenantService } from '../linear-tenant.service';
import { LINEAR_CONFIG, LINEAR_IMPORT_MAX_ISSUES, LINEAR_ISSUES_PAGE_SIZE, LinearSettingName } from '../linear.constants';
import { issueUpdateOf, parseStateMap, taskFieldsOf, watermarkOf } from './linear-issue.mapper';

/** What one issue became. */
type ApplyOutcome = 'created' | 'updated' | 'skipped';

/** The caches of one run: the statuses and priorities of the project, the employees by e-mail, the tags by label. */
interface ApplyContext {
	tenant: IIntegrationTenant;
	mapping: LinearTeamMapping;
	client: LinearApiClient;
	scope: { tenantId: ID; organizationId: ID };
	stateMap: Record<LinearStateType, string>;
	statusIdsByName: Map<string, ID>;
	priorityIdsByName: Map<string, ID>;
	employeeIdsByEmail: Map<string, ID | null>;
	tagIdsByLabelId: Map<string, ID | null>;
	/** Children whose parent is linked once every issue of the run is in. */
	pendingParents: Array<{ taskId: ID; parentSourceId: string }>;
	counts: LinearSyncCounts;
}

const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** How long a team's workflow states are kept for outbound pushes. */
const STATES_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The sync itself: an import of a mapped team's issues (every one, or those changed since the watermark),
 * one issue from a webhook, and a task's changes sent back to its issue. Inbound writes go through the
 * platform's `IntegrationMapSyncIssueCommand` (one id map per issue, a task created once and updated
 * after) with `triggeredEvent = false`, so nothing the sync writes is sent out again.
 */
@Injectable()
export class LinearSyncService {
	private readonly logger = new Logger(LinearSyncService.name);
	private readonly statesCache = new Map<string, { at: number; states: LinearWorkflowState[] }>();
	/** The pushes of each task, one after the other (a create and a quick edit never race to create two issues). */
	private readonly pushChains = new Map<string, Promise<void>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly tenants: LinearTenantService,
		private readonly mappings: LinearMappingService,
		private readonly runs: LinearSyncRunService,
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		private readonly integrationMapService: IntegrationMapService,
		private readonly integrationTenantSyncService: IntegrationTenantSyncService,
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig
	) {}

	// ---------------------------------------------------------------- inbound: import

	/**
	 * Imports the mapping's issues into a claimed run: every page of them (changed since the watermark unless
	 * `full`), each one a task created or updated, sub-issues linked to their parents at the end. The watermark
	 * moves only when every issue went through: a failed one keeps it, so the next import reads it again.
	 */
	async importMapping(tenant: IIntegrationTenant, mapping: LinearTeamMapping, run: LinearSyncRun, options: { full?: boolean } = {}): Promise<void> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const user = linearSyncUser(scope, this.connectedByUserId(tenant) ?? run.requestedByUserId ?? null);
		const counts = emptyCounts();
		const since = options.full ? null : mapping.lastCursor ?? null;
		let cursor: string | null = since;
		let error: string | null = null;
		try {
			await runInLinearContext(user, async () => {
				const context = await this.openContext(tenant, mapping, counts);
				let after: string | null = null;
				let seen = 0;
				for (;;) {
					const page = await this.withRateLimit(() =>
						context.client.issues(mapping.linearTeamId, { updatedAfter: since, after, first: LINEAR_ISSUES_PAGE_SIZE })
					);
					for (const issue of page.nodes) {
						await this.applyOne(context, issue);
					}
					cursor = watermarkOf(page.nodes, cursor);
					seen += page.nodes.length;
					await this.runs.progress(run, counts);
					if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor || seen >= LINEAR_IMPORT_MAX_ISSUES) break;
					after = page.pageInfo.endCursor;
				}
				await this.linkParents(context);
			});
			if (counts.failed > 0) {
				error = `${counts.failed} issue(s) could not be applied; the import position was kept so the next import reads them again.`;
			}
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused');
			}
			this.logger.warn(`Import of mapping ${mapping.id} failed: ${error}`);
		}
		await this.mappings.recordImport(mapping, { cursor: error ? undefined : cursor, error });
		await this.runs.finish(run, { counts, cursor: error ? since : cursor, error });
		if (!error) {
			await this.integrationTenantSyncService
				.recordSyncCompleted(tenant.id as ID, { tenantId: scope.tenantId, organizationId: scope.organizationId, counts: { issue: counts.created + counts.updated } })
				.catch((caught: unknown) => this.logger.warn(`The sync completion of ${tenant.id} could not be recorded: ${this.describe(caught)}`));
		}
	}

	// ---------------------------------------------------------------- inbound: webhook

	/**
	 * Applies one issue a webhook named: read again from Linear (the delivery carries ids, not the people), then
	 * imported through the team's inbound mapping. The import watermark is not touched: one issue says nothing
	 * about the older ones. Answers whether it was applied, or why not.
	 */
	async applyIssueFromWebhook(tenant: IIntegrationTenant, issueId: string, linearTeamId: string): Promise<{ applied: boolean; error: string | null }> {
		const mapping = await this.mappings.findInboundForTeam(tenant.id as ID, linearTeamId);
		if (!mapping) return { applied: false, error: null };
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const run = await this.runs.startWebhookRun(tenant, mapping.id);
		const counts = emptyCounts();
		let error: string | null = null;
		try {
			await runInLinearContext(linearSyncUser(scope, this.connectedByUserId(tenant)), async () => {
				const context = await this.openContext(tenant, mapping, counts);
				const issue = await this.withRateLimit(() => context.client.issue(issueId));
				if (!issue || issue.team?.id !== mapping.linearTeamId) {
					counts.skipped += 1;
					return;
				}
				counts[await this.applyIssue(context, issue)] += 1;
				await this.linkParents(context);
			});
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused');
			}
			this.logger.warn(`Webhook issue ${issueId} of mapping ${mapping.id} failed: ${error}`);
		}
		await this.runs.finish(run, { counts, cursor: mapping.lastCursor ?? null, error });
		return { applied: !error && counts.skipped === 0, error };
	}

	// ---------------------------------------------------------------- outbound

	/**
	 * Sends a task's changes to its issue, or creates the issue when the project's mapping sends new tasks out.
	 * The saved task is read again by id (an event may carry only the fields that changed); the pushes of one
	 * task run one after the other. Never throws: an outbound push is best effort beside the task's own save.
	 */
	pushTask(taskId: ID, tenantId: ID): Promise<void> {
		const key = String(taskId);
		const previous = this.pushChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.pushTaskNow(taskId, tenantId))
			.catch((caught: unknown) => this.logger.warn(`Task ${taskId} could not be sent to Linear: ${this.describe(caught)}`))
			.finally(() => {
				if (this.pushChains.get(key) === next) this.pushChains.delete(key);
			});
		this.pushChains.set(key, next);
		return next;
	}

	private async pushTaskNow(taskId: ID, tenantId: ID): Promise<void> {
		const task = await this.dataSource.getRepository(Task).findOne({ where: { id: taskId, tenantId } as never, relations: { tags: true } as never });
		if (!task?.projectId || !task.organizationId || !isTaskSyncAllowed(task, 'third-party')) return;
		const scope = { tenantId, organizationId: task.organizationId as ID };
		const mapping = await this.mappings.findOutboundForProject(scope, task.projectId as ID);
		if (!mapping) return;
		const tenant = await this.tenants.requireById(mapping.integrationId).catch(() => null);
		if (!tenant) return;
		try {
			const client = this.tenants.clientFor(tenant);
			const stateMap = parseStateMap(mapping.stateMap);
			const states = await this.teamStates(client, mapping.integrationId, mapping.linearTeamId);
			const input = issueUpdateOf(task, states, stateMap);
			const existing = await this.findIssueMap(task.id as ID, mapping.integrationId, scope);
			if (existing?.sourceId) {
				await this.withRateLimit(() => client.updateIssue(existing.sourceId, input));
				return;
			}
			if (!input.title) return;
			await this.createIssueOnce(client, mapping, task.id as ID, scope, input.title, input);
		} catch (caught) {
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused');
			}
			throw caught;
		}
	}

	/**
	 * Creates the issue of a task and its id map in one transaction, serialised per task across processes on
	 * Postgres (an advisory lock) and checked again inside it, so two pushes never create two issues.
	 */
	private async createIssueOnce(
		client: LinearApiClient,
		mapping: LinearTeamMapping,
		taskId: ID,
		scope: { tenantId: ID; organizationId: ID },
		title: string,
		input: ReturnType<typeof issueUpdateOf>
	): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			if (manager.connection.options.type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-linear:task:${taskId}`]);
			}
			const existing = await manager.findOne(IntegrationMap, {
				where: { entity: IntegrationEntity.ISSUE, gauzyId: taskId, integrationId: mapping.integrationId, ...scope } as never
			});
			if (existing) return;
			const issue = await this.withRateLimit(() => client.createIssue({ ...input, teamId: mapping.linearTeamId, title }));
			await manager.save(
				IntegrationMap,
				Object.assign(new IntegrationMap(), {
					entity: IntegrationEntity.ISSUE,
					gauzyId: taskId,
					sourceId: issue.id,
					integrationId: mapping.integrationId,
					...scope
				})
			);
		});
	}

	// ---------------------------------------------------------------- one issue

	private async openContext(tenant: IIntegrationTenant, mapping: LinearTeamMapping, counts: LinearSyncCounts): Promise<ApplyContext> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		// The project's own statuses and priorities, and the organization's (no project) under them.
		const where = [{ ...scope, projectId: mapping.projectId }, { ...scope, projectId: IsNull() }];
		const [statuses, priorities] = await Promise.all([
			this.dataSource.getRepository(TaskStatus).find({ where: where as never }).catch(() => [] as TaskStatus[]),
			this.dataSource.getRepository(TaskPriority).find({ where: where as never }).catch(() => [] as TaskPriority[])
		]);
		// A project's own status wins over the organization's of the same name.
		const statusIdsByName = new Map<string, ID>();
		for (const status of [...statuses].sort((a, b) => (a.projectId ? 0 : 1) - (b.projectId ? 0 : 1))) {
			const key = String(status.name ?? '').toLowerCase();
			if (key && !statusIdsByName.has(key)) statusIdsByName.set(key, status.id as ID);
		}
		const priorityIdsByName = new Map<string, ID>();
		for (const priority of [...priorities].sort((a, b) => (a.projectId ? 0 : 1) - (b.projectId ? 0 : 1))) {
			const key = String(priority.name ?? '').toLowerCase();
			if (key && !priorityIdsByName.has(key)) priorityIdsByName.set(key, priority.id as ID);
		}
		return {
			tenant,
			mapping,
			client: this.tenants.clientFor(tenant),
			scope,
			stateMap: parseStateMap(mapping.stateMap),
			statusIdsByName,
			priorityIdsByName,
			employeeIdsByEmail: new Map(),
			tagIdsByLabelId: new Map(),
			pendingParents: [],
			counts
		};
	}

	/** One issue of an import: a failure counts and is logged (the watermark is then kept by the caller); a refused token stops the run. */
	private async applyOne(context: ApplyContext, issue: LinearIssue): Promise<void> {
		try {
			const outcome = await this.applyIssue(context, issue);
			context.counts[outcome] += 1;
		} catch (caught) {
			if (caught instanceof LinearApiError) throw caught;
			context.counts.failed += 1;
			this.logger.warn(`Issue ${issue.identifier} (${issue.id}) could not be applied: ${this.describe(caught)}`);
		}
	}

	/** One issue → one task: created once, updated after, by the platform's id map. */
	private async applyIssue(context: ApplyContext, issue: LinearIssue): Promise<ApplyOutcome> {
		const { scope, mapping } = context;
		const integrationId = mapping.integrationId;
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, sourceId: issue.id, integrationId, ...scope })
			.catch(() => null);
		// An archived issue that never became a task stays out; one that did keeps its task as it was.
		if (issue.archivedAt) return 'skipped';
		const fields = taskFieldsOf(issue, context.stateMap);
		const assigneeId = await this.employeeIdOf(context, issue.assignee?.email ?? null);
		const tagIds = await this.tagIdsOf(context, issue.labels?.nodes ?? []);
		const entity = {
			...scope,
			projectId: mapping.projectId,
			title: fields.title,
			// Null when Linear cleared it: the task's old description goes too.
			description: fields.description,
			status: fields.status,
			taskStatusId: context.statusIdsByName.get(fields.status.toLowerCase()) ?? null,
			priority: fields.priority ?? null,
			taskPriorityId: fields.priority ? context.priorityIdsByName.get(fields.priority.toLowerCase()) ?? null : null,
			dueDate: fields.dueDate,
			members: assigneeId ? [{ id: assigneeId }] : [],
			tags: tagIds.map((id) => ({ id })),
			// A sub-issue is linked once its parent is in (below); an issue without a parent leaves its former one.
			...(issue.parent?.id ? {} : { parentId: null })
		} as unknown as ITaskCreateInput | ITaskUpdateInput;
		const map: IIntegrationMap = await this.commandBus.execute(
			new IntegrationMapSyncIssueCommand({ entity, sourceId: issue.id, integrationId, ...scope }, false)
		);
		if (issue.parent?.id && map?.gauzyId) {
			context.pendingParents.push({ taskId: map.gauzyId as ID, parentSourceId: issue.parent.id });
		}
		return existing ? 'updated' : 'created';
	}

	/** Sub-issues point at their parent's task once every issue of the run is in (a parent may come later in the pages). */
	private async linkParents(context: ApplyContext): Promise<void> {
		for (const pending of context.pendingParents.splice(0)) {
			const parent = await this.integrationMapService
				.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, sourceId: pending.parentSourceId, integrationId: context.mapping.integrationId, ...context.scope })
				.catch(() => null);
			if (!parent?.gauzyId || parent.gauzyId === pending.taskId) continue;
			await this.commandBus
				.execute(new TaskUpdateCommand(pending.taskId, { ...context.scope, parentId: parent.gauzyId as ID } as ITaskUpdateInput, false))
				.catch((caught: unknown) => this.logger.warn(`Task ${pending.taskId} could not be linked to its parent: ${this.describe(caught)}`));
		}
	}

	/** The employee of the organization with that e-mail, or null (an assignee without one is left unassigned). */
	private async employeeIdOf(context: ApplyContext, email: string | null): Promise<ID | null> {
		const key = email?.trim().toLowerCase();
		if (!key) return null;
		if (context.employeeIdsByEmail.has(key)) return context.employeeIdsByEmail.get(key) ?? null;
		const { items } = await this.employeeService
			.findAll({ where: { ...context.scope, isActive: true, isArchived: false, user: { email: In([key, email as string]) } }, relations: { user: true }, take: 1 } as never)
			.catch(() => ({ items: [] }));
		const id = (items[0]?.id as ID | undefined) ?? null;
		context.employeeIdsByEmail.set(key, id);
		return id;
	}

	/** The tags of the issue's labels: one per label, created once by the platform's label sync. */
	private async tagIdsOf(context: ApplyContext, labels: LinearLabel[]): Promise<ID[]> {
		const ids: ID[] = [];
		for (const label of labels) {
			if (!label?.id || !label.name) continue;
			if (!context.tagIdsByLabelId.has(label.id)) {
				const map: IIntegrationMap | null = await this.commandBus
					.execute(
						new IntegrationMapSyncLabelCommand({
							entity: { name: label.name, color: label.color || '#6E7681', ...context.scope } as never,
							sourceId: label.id,
							integrationId: context.mapping.integrationId,
							...context.scope
						})
					)
					.catch((caught: unknown) => {
						this.logger.warn(`Label ${label.name} could not be synced: ${this.describe(caught)}`);
						return null;
					});
				context.tagIdsByLabelId.set(label.id, (map?.gauzyId as ID | undefined) ?? null);
			}
			const id = context.tagIdsByLabelId.get(label.id);
			if (id) ids.push(id);
		}
		return ids;
	}

	// ---------------------------------------------------------------- helpers

	private async findIssueMap(taskId: ID, integrationId: ID, scope: { tenantId: ID; organizationId: ID }): Promise<IIntegrationMap | null> {
		return this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, gauzyId: taskId, integrationId, ...scope })
			.catch(() => null);
	}

	private async teamStates(client: LinearApiClient, integrationId: ID, linearTeamId: string): Promise<LinearWorkflowState[]> {
		const key = `${integrationId}:${linearTeamId}`;
		const cached = this.statesCache.get(key);
		if (cached && Date.now() - cached.at < STATES_TTL_MS) return cached.states;
		const team = await this.withRateLimit(() => client.team(linearTeamId));
		const states = team?.states ?? [];
		this.statesCache.set(key, { at: Date.now(), states });
		return states;
	}

	/** Waits once for a rate limit to lift (what Linear asked, up to a minute), then tries again. */
	private async withRateLimit<T>(call: () => Promise<T>): Promise<T> {
		try {
			return await call();
		} catch (caught) {
			if (caught instanceof LinearApiError && caught.isRateLimited) {
				await sleep(Math.min(Math.max((caught.retryAfterSeconds ?? 5) * 1000, 1000), RATE_LIMIT_MAX_WAIT_MS));
				return call();
			}
			throw caught;
		}
	}

	private connectedByUserId(tenant: IIntegrationTenant): ID | null {
		const value = this.tenants.settingsOf(tenant)[LinearSettingName.CONNECTED_BY_USER_ID];
		return value ? (value as ID) : null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
