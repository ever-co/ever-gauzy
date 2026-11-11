import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { ID, IIntegrationMap, IIntegrationTenant, IntegrationEntity, isTaskSyncAllowed, ITag, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import {
	EmployeeService,
	IntegrationMap,
	IntegrationMapService,
	IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand,
	IntegrationTenantSyncService,
	syncedValuesOf,
	Task,
	TaskPriority,
	TaskStatus,
	TaskUpdateCommand,
	withoutKeptFields
} from '@gauzy/core';
import { LinearApiClient, LinearApiError, LinearIssue, LinearLabel, LinearStateType, LinearWorkflowState } from '../client/linear-api.client';
import { LinearSyncRun } from '../entities/linear-sync-run.entity';
import { LinearTeamMapping } from '../entities/linear-team-mapping.entity';
import { LinearConfig } from '../linear-config';
import { LinearMappingService } from '../linear-mapping.service';
import { linearSyncUser, runInLinearContext } from '../linear-process';
import { LinearSyncConflictService } from '../linear-sync-conflict.service';
import { emptyCounts, LinearSyncCounts, LinearSyncRunService } from '../linear-sync-run.service';
import { LinearTenantService } from '../linear-tenant.service';
import { LINEAR_CONFIG, LINEAR_IMPORT_CLOCK_SKEW_MS, LINEAR_IMPORT_MAX_ISSUES, LINEAR_ISSUES_PAGE_SIZE, LinearSettingName } from '../linear.constants';
import { LinearAuthor, LinearIssueDetailsService } from './linear-issue-details.service';
import { issueUpdateOf, parseStateMap, taskFieldsOf } from './linear-issue.mapper';

/** What one issue became. */
type ApplyOutcome = 'created' | 'updated' | 'skipped';
/** What one issue became, and the platform task it is (none when skipped). */
interface ApplyResult {
	outcome: ApplyOutcome;
	taskId: ID | null;
}

/** A connection's client, replaced once when Linear refused the token and a renewal worked. */
interface ClientHolder {
	tenant: IIntegrationTenant;
	client: LinearApiClient;
	renewed: boolean;
}

/** The caches of one run: the statuses and priorities of the project, the employees by e-mail, the tags by label. */
interface ApplyContext extends ClientHolder {
	mapping: LinearTeamMapping;
	scope: { tenantId: ID; organizationId: ID };
	/** The run the issues are applied in: the conflicts it finds name it. */
	runId: ID | null;
	/** How many fields changed on both sides in this run (Linear's value applied, the task's recorded). */
	conflicts: number;
	stateMap: Record<LinearStateType, string>;
	statusIdsByName: Map<string, ID>;
	priorityIdsByName: Map<string, ID>;
	employeeIdsByEmail: Map<string, ID | null>;
	tagIdsByLabelId: Map<string, ID | null>;
	/** Children whose parent is linked once every issue of the run is in. */
	pendingParents: Array<{ taskId: ID; parentSourceId: string }>;
	/** The user who connected: the comments nobody here wrote are theirs to own. */
	connectedByUserId: ID | null;
	/** The comment authors by e-mail, once per run. */
	authorsByEmail: Map<string, LinearAuthor | null>;
	/** What the details import brought in this run (comments, attachments as links): reported, not counted on the run. */
	details: { comments: number; links: number; failed: number };
	counts: LinearSyncCounts;
}

/** A lookup that did not answer: the task's relation is left as it is, not emptied. */
class ResolutionFailed extends Error {
	constructor(what: string, cause: unknown) {
		super(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`);
		this.name = 'ResolutionFailed';
	}
}

const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** How long a team's workflow states are kept for outbound pushes. */
const STATES_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The sync itself: an import of a mapped team's issues (every one, or those changed since the watermark),
 * one issue from a webhook, and a task's changes sent back to its issue. Inbound writes go through the
 * platform's `IntegrationMapSyncIssueCommand` (one id map per issue, a task created once and updated
 * after) with `triggeredEvent = false`, so nothing the sync writes is sent out again. Every call to Linear
 * waits once for a rate limit, and renews the token once when Linear refused it.
 */
@Injectable()
export class LinearSyncService {
	private readonly logger = new Logger(LinearSyncService.name);
	private readonly statesCache = new Map<string, { at: number; states: LinearWorkflowState[] }>();
	/** The pushes of each task, one after the other (a create and a quick edit never race to create two issues). */
	private readonly pushChains = new Map<string, Promise<void>>();
	/** The applies of each issue, one after the other (an import and a webhook never create two tasks for one issue). */
	private readonly issueChains = new Map<string, Promise<ApplyResult>>();
	private readonly detailsChains = new Map<string, Promise<void>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly tenants: LinearTenantService,
		private readonly mappings: LinearMappingService,
		private readonly runs: LinearSyncRunService,
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		private readonly integrationMapService: IntegrationMapService,
		private readonly integrationTenantSyncService: IntegrationTenantSyncService,
		private readonly issueDetails: LinearIssueDetailsService,
		private readonly conflicts: LinearSyncConflictService,
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig
	) {}

	// ---------------------------------------------------------------- inbound: import

	/**
	 * Imports the mapping's issues into a claimed run: every page of them (changed since the watermark unless
	 * `full`), each one a task created or updated, sub-issues linked to their parents at the end. The watermark
	 * moves only when every issue went through and every page was read: a failed issue, or a run stopped at the
	 * safety cap, keeps it so the next import reads them again. The run row is always finished.
	 */
	async importMapping(tenant: IIntegrationTenant, mapping: LinearTeamMapping, run: LinearSyncRun, options: { full?: boolean } = {}): Promise<void> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const user = linearSyncUser(scope, this.connectedByUserId(tenant) ?? run.requestedByUserId ?? null);
		const counts = emptyCounts();
		const since = options.full ? null : mapping.lastCursor ?? null;
		// The next import starts a little before this run did: an issue changed while the pages were read would otherwise
		// sit below the newest change read and be skipped next time. Recorded only by a complete run (a capped one keeps
		// its position); reading a few issues again is harmless (the apply is idempotent through the id map).
		const cursor = new Date(Date.now() - LINEAR_IMPORT_CLOCK_SKEW_MS).toISOString();
		let error: string | null = null;
		let complete = false;
		try {
			await runInLinearContext(user, async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				let after: string | null = null;
				let seen = 0;
				for (;;) {
					const page = await this.call(context, (client) =>
						client.issues(mapping.linearTeamId, { updatedAfter: since, after, first: LINEAR_ISSUES_PAGE_SIZE })
					);
					for (const issue of page.nodes) {
						await this.applyOne(context, issue);
					}
					seen += page.nodes.length;
					await this.runs.progress(run, counts);
					if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) {
						complete = true;
						break;
					}
					if (seen >= LINEAR_IMPORT_MAX_ISSUES) break;
					after = page.pageInfo.endCursor;
				}
				await this.linkParents(context);
				this.reportDetails(context);
			});
			if (counts.failed > 0) {
				error = `${counts.failed} issue(s) could not be applied; the import position was kept so the next import reads them again.`;
			} else if (!complete) {
				error = `The import stopped at ${LINEAR_IMPORT_MAX_ISSUES} issues (the pages come newest first); the import position was kept. Run it again to continue.`;
			}
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[LinearSettingName.ACCESS_TOKEN] ?? null);
			}
			this.logger.warn(`Import of mapping ${mapping.id} failed: ${error}`);
		} finally {
			try {
				await this.mappings.recordImport(mapping, { cursor: error ? undefined : cursor, error });
			} catch (caught) {
				error = error ?? this.describe(caught);
				this.logger.warn(`The import position of mapping ${mapping.id} could not be written: ${this.describe(caught)}`);
			}
			// Always: a run row left RUNNING would block the mapping until it counts as abandoned.
			await this.runs.finish(run, { counts, cursor: error ? since : cursor, error }).catch((caught: unknown) => {
				this.logger.warn(`Run ${run.id} could not be finished: ${this.describe(caught)}`);
			});
		}
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
	 * about the older ones, and a delivery that was lost is read by the next import. Answers whether it was
	 * applied, or why not.
	 */
	async applyIssueFromWebhook(tenant: IIntegrationTenant, issueId: string, linearTeamId: string | null): Promise<{ applied: boolean; error: string | null }> {
		// A comment's or attachment's delivery may not say the team: the issue's team is read first (a light read, through
		// the same waits and renewal as every other, a refused token recorded as everywhere else).
		let teamId = linearTeamId;
		if (!teamId) {
			try {
				const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
				teamId = await this.call(holder, (client) => client.issueTeamId(issueId));
			} catch (caught) {
				if (caught instanceof LinearApiError && caught.isUnauthorized) await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[LinearSettingName.ACCESS_TOKEN] ?? null);
				return { applied: false, error: this.describe(caught) };
			}
			if (!teamId) return { applied: false, error: null };
		}
		const mapping = await this.mappings.findInboundForTeam(tenant.id as ID, teamId);
		if (!mapping) return { applied: false, error: null };
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const run = await this.runs.startWebhookRun(tenant, mapping.id as ID);
		const counts = emptyCounts();
		let error: string | null = null;
		try {
			await runInLinearContext(linearSyncUser(scope, this.connectedByUserId(tenant)), async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				const issue = await this.call(context, (client) => client.issue(issueId));
				if (!issue || issue.team?.id !== mapping.linearTeamId) {
					counts.skipped += 1;
					return;
				}
				await this.applyOne(context, issue);
				await this.linkParents(context);
				this.reportDetails(context);
			});
			// A task or a detail that could not be written is the run's failure: the delivery is not remembered as applied.
			if (counts.failed > 0) error = `${counts.failed} issue(s) or detail(s) could not be applied.`;
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[LinearSettingName.ACCESS_TOKEN] ?? null);
			}
			this.logger.warn(`Webhook issue ${issueId} of mapping ${mapping.id} failed: ${error}`);
		} finally {
			await this.runs.finish(run, { counts, cursor: mapping.lastCursor ?? null, error }).catch(() => undefined);
		}
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
		const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
		try {
			const stateMap = parseStateMap(mapping.stateMap);
			const states = await this.teamStates(holder, mapping.integrationId, mapping.linearTeamId);
			const input = issueUpdateOf(task, states, stateMap);
			const existing = await this.findIssueMap(task.id as ID, mapping.integrationId, scope);
			if (existing?.sourceId) {
				await this.call(holder, (client) => client.updateIssue(existing.sourceId, input));
				return;
			}
			if (!input.title) return;
			await this.createIssueOnce(holder, mapping, task.id as ID, scope, input.title, input);
		} catch (caught) {
			if (caught instanceof LinearApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[LinearSettingName.ACCESS_TOKEN] ?? null);
			}
			throw caught;
		}
	}

	/**
	 * Creates the issue of a task and records its id map. The pushes of one task are already one after the other in
	 * this process (`pushChains`); the issue is created outside any transaction (no pool connection held across the
	 * call to Linear), and the map is written in a short transaction locked per task on Postgres that looks again:
	 * when another process recorded a map meanwhile, the issue just created is archived again, so the task keeps
	 * one issue.
	 */
	/**
	 * Runs `work` in a transaction that holds a cross-process lock on each key: an advisory lock on Postgres (taken
	 * in the transaction, released with its commit), a named lock on MySQL / MariaDB (a session lock: taken on the
	 * transaction's own connection before it starts and released only after it committed or rolled back, so a waiter
	 * always reads what the holder wrote); SQLite serializes writers. The statements are parameterized: a key is a
	 * bind value, never part of the SQL.
	 */
	private async lockedTransaction<T>(keys: readonly string[], work: (manager: EntityManager) => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		const dialect = runner.connection.options.type;
		const named: string[] = [];
		try {
			if (dialect === 'mysql' || dialect === 'mariadb') {
				for (const key of keys) {
					const name = createHash('sha1').update(key).digest('hex');
					const rows = (await runner.query('SELECT GET_LOCK(?, 30) AS got', [name])) as Array<{ got?: unknown }>;
					if (Number(rows?.[0]?.got) !== 1) throw new Error(`The lock ${key} could not be taken within 30 s`);
					named.push(name);
				}
			}
			await runner.startTransaction();
			try {
				if (dialect === 'postgres') {
					for (const key of keys) await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
				}
				const result = await work(runner.manager);
				await runner.commitTransaction();
				return result;
			} catch (error) {
				await runner.rollbackTransaction().catch(() => undefined);
				throw error;
			}
		} finally {
			for (const name of named.reverse()) {
				await runner.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
			}
			await runner.release();
		}
	}

	private async createIssueOnce(
		holder: ClientHolder,
		mapping: LinearTeamMapping,
		taskId: ID,
		scope: { tenantId: ID; organizationId: ID },
		title: string,
		input: ReturnType<typeof issueUpdateOf>
	): Promise<void> {
		const issue = await this.call(holder, (client) => client.createIssue({ ...input, teamId: mapping.linearTeamId, title }));
		const recorded = await this.lockedTransaction([`integration-linear:task:${taskId}`], async (manager) => {
			const existing = await manager.findOne(IntegrationMap, {
				where: { entity: IntegrationEntity.ISSUE, gauzyId: taskId, integrationId: mapping.integrationId, ...scope } as never
			});
			if (existing) return false;
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
			return true;
		});
		if (!recorded) {
			await this.call(holder, (client) => client.archiveIssue(issue.id)).catch((caught: unknown) => {
				this.logger.warn(`Issue ${issue.identifier} was created twice for task ${taskId} and could not be archived: ${this.describe(caught)}`);
			});
		}
	}

	// ---------------------------------------------------------------- one issue

	private async openContext(tenant: IIntegrationTenant, mapping: LinearTeamMapping, counts: LinearSyncCounts, runId: ID | null): Promise<ApplyContext> {
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
			client: await this.tenants.clientReady(tenant),
			renewed: false,
			mapping,
			scope,
			runId,
			conflicts: 0,
			stateMap: parseStateMap(mapping.stateMap),
			statusIdsByName,
			priorityIdsByName,
			employeeIdsByEmail: new Map(),
			tagIdsByLabelId: new Map(),
			pendingParents: [],
			connectedByUserId: this.connectedByUserId(tenant),
			authorsByEmail: new Map(),
			details: { comments: 0, links: 0, failed: 0 },
			counts
		};
	}

	/** One issue of a run, then its comments and attachments: a failure counts and is logged; a refused token stops the run. */
	private async applyOne(context: ApplyContext, issue: LinearIssue): Promise<void> {
		let taskId: ID | null = null;
		try {
			const result = await this.applyIssue(context, issue);
			context.counts[result.outcome] += 1;
			taskId = result.taskId;
		} catch (caught) {
			if (caught instanceof LinearApiError) throw caught;
			context.counts.failed += 1;
			this.logger.warn(`Issue ${issue.identifier} (${issue.id}) could not be applied: ${this.describe(caught)}`);
		}
		// Behind the issue itself: its comments and attachments (they came with it), kept one run at a time per issue
		// under the issue's own lock: a webhook and an import that meet on one issue would otherwise both find no
		// mapped comment and keep it twice.
		if (taskId) {
			const detailsContext = this.detailsContextOf(context);
			const resolvedTaskId = taskId;
			try {
				await this.serializedDetails(`${context.mapping.integrationId}:${issue.id}`, () => this.issueDetails.apply(detailsContext, issue, resolvedTaskId));
			} catch (caught) {
				// The API's refusal is the run's; a lock that could not be taken, or a store error, is this issue's details failing, and the run goes on.
				if (caught instanceof LinearApiError) throw caught;
				context.details.failed += 1;
				this.logger.warn(`The details of issue ${issue.id} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	/** What the details import needs of a run: its scope and the run's own caches and tallies. */
	private detailsContextOf(context: ApplyContext) {
		return {
			scope: context.scope,
			integrationId: context.mapping.integrationId,
			connectedByUserId: context.connectedByUserId,
			authorsByEmail: context.authorsByEmail,
			details: context.details
		};
	}

	/**
	 * One line per run about the details, when there were any; what could not be read or kept counts as a failure
	 * of the run, so the import position is kept and the next import reads the task again.
	 */
	private reportDetails(context: ApplyContext): void {
		if (context.conflicts) {
			this.logger.log(`Mapping ${context.mapping.id}: ${context.conflicts} field(s) changed on both sides; Linear's value applied, the task's recorded as a conflict`);
			context.conflicts = 0;
		}
		const { comments, links, failed } = context.details;
		if (failed) {
			context.counts.failed += failed;
			// Counted once: a second report on the same context would count them again.
			context.details.failed = 0;
		}
		if (comments || links || failed) {
			this.logger.log(`Mapping ${context.mapping.id}: ${comments} comment(s) and ${links} attachment link(s) brought in, ${failed} not read or kept`);
		}
	}

	/** The details of one issue, one run at a time: chained in the process, locked across processes (the details service writes through its own repositories; the transaction is the mutex). */
	private serializedDetails(key: string, work: () => Promise<void>): Promise<void> {
		const previous = this.detailsChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.lockedTransaction([`integration-linear:issue-details:${key}`], () => work()))
			.finally(() => {
				if (this.detailsChains.get(key) === next) this.detailsChains.delete(key);
			});
		this.detailsChains.set(key, next);
		return next;
	}

	/**
	 * One issue → one task, one apply at a time per issue: in this process the applies of an issue are chained,
	 * and across processes on Postgres they wait for an advisory lock on the issue held while the platform's
	 * id-map command runs (an import and a webhook, or two deliveries, never create two tasks for one issue).
	 */
	private applyIssue(context: ApplyContext, issue: LinearIssue): Promise<ApplyResult> {
		const key = `${context.mapping.integrationId}:${issue.id}`;
		const previous = this.issueChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.lockedTransaction([`integration-linear:issue:${key}`], () => this.applyIssueNow(context, issue)))
			.finally(() => {
				if (this.issueChains.get(key) === next) this.issueChains.delete(key);
			});
		this.issueChains.set(key, next);
		return next;
	}

	/**
	 * One issue → one task: created once, updated after, by the platform's id map. A relation whose lookup did
	 * not answer (the employee by e-mail, a label's tag) is left as the task has it; an empty value from Linear
	 * clears it. The synced fields of a mapped task are merged three ways with what the issue and the task last
	 * agreed on: a field changed only on the platform keeps the task's value, one changed on both sides takes
	 * Linear's and records the task's as a conflict.
	 */
	private async applyIssueNow(context: ApplyContext, issue: LinearIssue): Promise<ApplyResult> {
		const { scope, mapping } = context;
		const integrationId = mapping.integrationId;
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, sourceId: issue.id, integrationId, ...scope })
			.catch(() => null);
		// An archived issue that never became a task stays out; one that did keeps its task as it was.
		if (issue.archivedAt) return { outcome: 'skipped', taskId: null };
		const fields = taskFieldsOf(issue, context.stateMap);
		const external = syncedValuesOf(fields);
		const merge = await this.conflicts.prepare({ ...scope, integrationId, sourceId: issue.id, taskId: (existing?.gauzyId as ID | undefined) ?? null, external });
		const members = await this.membersOf(context, issue.assignee?.email ?? null);
		const tags = await this.tagsOf(context, issue.labels?.nodes ?? []);
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
			...(members === undefined ? {} : { members }),
			...(tags === undefined ? {} : { tags }),
			// A sub-issue is linked once its parent is in (below); an issue without a parent leaves its former one.
			...(issue.parent?.id ? {} : { parentId: null })
		};
		const write = withoutKeptFields(entity as Record<string, unknown>, merge?.keepPlatform ?? []) as unknown as ITaskCreateInput | ITaskUpdateInput;
		// The conflicts are recorded while the task still holds its own values: a failure after the write cannot lose them.
		const recorded = await this.conflicts.record({ ...scope, integrationId, mappingId: mapping.id as ID, runId: context.runId, sourceId: issue.id, merge });
		let map: IIntegrationMap;
		try {
			map = await this.commandBus.execute(new IntegrationMapSyncIssueCommand({ entity: write, sourceId: issue.id, integrationId, ...scope }, false));
		} catch (caught) {
			// Not written: the task keeps its values, and the conflicts recorded for them are taken back.
			await this.conflicts
				.discard(recorded)
				.catch((error: unknown) => this.logger.warn(`The conflicts recorded for issue ${issue.id} could not be taken back: ${this.describe(error)}`));
			throw caught;
		}
		if (issue.parent?.id && map?.gauzyId) {
			context.pendingParents.push({ taskId: map.gauzyId as ID, parentSourceId: issue.parent.id });
		}
		if (map?.gauzyId) {
			// The issue's values become what both sides agreed on; a failure here fails the issue (its conflicts stay recorded) and the next import writes it again.
			await this.conflicts.settle({ ...scope, integrationId, sourceId: issue.id, taskId: map.gauzyId as ID, external, recorded });
			context.conflicts += recorded.length;
		}
		return { outcome: existing ? 'updated' : 'created', taskId: (map?.gauzyId as ID | undefined) ?? null };
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

	/**
	 * The task's members for the issue's assignee: the employee with that e-mail, nobody when the issue has no
	 * assignee or no employee has the e-mail, and `undefined` (the relation left alone) when the lookup failed.
	 */
	private async membersOf(context: ApplyContext, email: string | null): Promise<Array<{ id: ID }> | undefined> {
		const key = email?.trim().toLowerCase();
		if (!key) return [];
		try {
			if (!context.employeeIdsByEmail.has(key)) {
				const { items } = await this.employeeService.findAll({
					where: { ...context.scope, isActive: true, isArchived: false, user: { email: In([key, email as string]) } },
					relations: { user: true },
					take: 1
				} as never);
				context.employeeIdsByEmail.set(key, (items[0]?.id as ID | undefined) ?? null);
			}
		} catch (caught) {
			this.logger.warn(`The employee of ${key} could not be looked up: ${new ResolutionFailed('employee', caught).message}`);
			return undefined;
		}
		const id = context.employeeIdsByEmail.get(key);
		return id ? [{ id }] : [];
	}

	/**
	 * The task's tags for the issue's labels: one per label, created once by the platform's label sync; `undefined`
	 * (the relation left alone) when any label's sync failed, so a passing failure never strips the task's tags.
	 */
	private async tagsOf(context: ApplyContext, labels: LinearLabel[]): Promise<Array<{ id: ID }> | undefined> {
		const ids: ID[] = [];
		for (const label of labels) {
			if (!label?.id || !label.name) continue;
			if (!context.tagIdsByLabelId.has(label.id)) {
				try {
					// The label sync answers the tag itself (created once, updated after), not its id map.
					const tag: ITag = await this.commandBus.execute(
						new IntegrationMapSyncLabelCommand({
							entity: { name: label.name, color: label.color || '#6E7681', ...context.scope } as never,
							sourceId: label.id,
							integrationId: context.mapping.integrationId,
							...context.scope
						})
					);
					context.tagIdsByLabelId.set(label.id, (tag?.id as ID | undefined) ?? null);
				} catch (caught) {
					this.logger.warn(`Label ${label.name} could not be synced: ${new ResolutionFailed('label', caught).message}`);
					return undefined;
				}
			}
			const id = context.tagIdsByLabelId.get(label.id);
			if (id) ids.push(id);
		}
		return ids.map((id) => ({ id }));
	}

	// ---------------------------------------------------------------- helpers

	private async findIssueMap(taskId: ID, integrationId: ID, scope: { tenantId: ID; organizationId: ID }): Promise<IIntegrationMap | null> {
		return this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, gauzyId: taskId, integrationId, ...scope })
			.catch(() => null);
	}

	private async teamStates(holder: ClientHolder, integrationId: ID, linearTeamId: string): Promise<LinearWorkflowState[]> {
		const key = `${integrationId}:${linearTeamId}`;
		const cached = this.statesCache.get(key);
		if (cached && Date.now() - cached.at < STATES_TTL_MS) return cached.states;
		const team = await this.call(holder, (client) => client.team(linearTeamId));
		const states = team?.states ?? [];
		this.statesCache.set(key, { at: Date.now(), states });
		return states;
	}

	/**
	 * One call to Linear with the connection's client: a rate limit is waited out once (what Linear asked, up to a
	 * minute) and the call made again; a refused token is renewed once with the refresh token and the call made
	 * again with the new client. Anything else is the caller's.
	 */
	private async call<T>(holder: ClientHolder, make: (client: LinearApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(holder.client);
		} catch (caught) {
			if (caught instanceof LinearApiError && caught.isRateLimited) {
				await sleep(Math.min(Math.max((caught.retryAfterSeconds ?? 5) * 1000, 1000), RATE_LIMIT_MAX_WAIT_MS));
				return make(holder.client);
			}
			if (caught instanceof LinearApiError && caught.isUnauthorized && !holder.renewed) {
				holder.renewed = true;
				const renewed = await this.tenants.refreshAccessToken(holder.tenant);
				if (renewed) {
					holder.client = renewed;
					return make(holder.client);
				}
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
