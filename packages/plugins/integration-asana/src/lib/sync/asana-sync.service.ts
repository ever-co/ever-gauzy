import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { ID, IIntegrationMap, IIntegrationTenant, IntegrationEntity, isTaskSyncAllowed, ITag, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import {
	EmployeeService,
	IntegrationMap,
	IntegrationMapService,
	IntegrationMapSyncLabelCommand,
	IntegrationMapSyncTaskCommand,
	IntegrationTenantSyncService,
	syncedValuesOf,
	Task,
	TaskPriority,
	TaskStatus,
	TaskUpdateCommand,
	withoutKeptFields
} from '@gauzy/core';
import { AsanaApiClient, AsanaApiError, AsanaSection, AsanaTag, AsanaTask } from '../client/asana-api.client';
import { AsanaSyncRun } from '../entities/asana-sync-run.entity';
import { AsanaProjectMapping } from '../entities/asana-project-mapping.entity';
import { AsanaConfig, asanaWebhookTargetOf } from '../asana-config';
import { AsanaMappingService } from '../asana-mapping.service';
import { asanaSyncUser, runInAsanaContext } from '../asana-process';
import { AsanaSyncConflictService } from '../asana-sync-conflict.service';
import { emptyCounts, AsanaSyncCounts, AsanaSyncRunService } from '../asana-sync-run.service';
import { AsanaTenantService } from '../asana-tenant.service';
import { ASANA_APPLY_CONCURRENCY, ASANA_CONFIG, ASANA_IMPORT_CLOCK_SKEW_MS, ASANA_SUBTASK_MAX_DEPTH, ASANA_TASKS_PAGE_SIZE, AsanaSettingName } from '../asana.constants';
import { AsanaAuthor, AsanaTaskDetailsService } from './asana-task-details.service';
import { asanaUpdateOf, knownStatusesOf, parseSectionMap, sectionForStatus, statusKey, taskFieldsOf } from './asana-task.mapper';

/** What one Asana task became, and the platform task it is (none when skipped). */
type ApplyOutcome = 'created' | 'updated' | 'skipped';
interface ApplyResult {
	outcome: ApplyOutcome;
	taskId: ID | null;
}

/** A connection's client, replaced once when Asana refused the token and a renewal worked. */
interface ClientHolder {
	tenant: IIntegrationTenant;
	client: AsanaApiClient;
	renewed: boolean;
}

/** The caches of one run: the statuses and priorities of the project, the employees by e-mail, the tags by Asana tag. */
interface ApplyContext extends ClientHolder {
	mapping: AsanaProjectMapping;
	scope: { tenantId: ID; organizationId: ID };
	/** The run the items are applied in: the conflicts it finds name it. */
	runId: ID | null;
	/** How many fields changed on both sides in this run (Asana's value applied, the task's recorded). */
	conflicts: number;
	sectionMap: Record<string, string>;
	/** The statuses a task may take, by key (`statusKey`) → the name as stored, and → the row's id. */
	knownStatuses: Map<string, string>;
	statusIdsByName: Map<string, ID>;
	priorityIdsByName: Map<string, ID>;
	employeeIdsByEmail: Map<string, ID | null>;
	tagIdsByAsanaGid: Map<string, ID | null>;
	/** Subtasks whose parent is linked once every task of the run is in. */
	pendingParents: Array<{ taskId: ID; parentSourceId: string }>;
	/** The tasks applied in this run, so a subtask reached twice (through its parent and on its own) is applied once. */
	applied: Set<string>;
	/** The user who connected: the comments nobody here wrote are theirs to own. */
	connectedByUserId: ID | null;
	/** The comment authors by e-mail, once per run. */
	authorsByEmail: Map<string, AsanaAuthor | null>;
	/** What the details import brought in this run (comments, attachments as links): reported, not counted on the run. */
	details: { comments: number; links: number; failed: number };
	counts: AsanaSyncCounts;
}

const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** How long a project's sections are kept for outbound pushes. */
const SECTIONS_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The sync itself: an import of a mapped Asana project's tasks (every one, or those changed since the
 * watermark), one task from a webhook, and a platform task's changes sent back. Inbound writes go through the
 * platform's `IntegrationMapSyncTaskCommand` (one id map per Asana task, a task created once and updated after)
 * with `triggeredEvent = false`, so nothing the sync writes is sent out again. Every call to Asana waits once
 * for a rate limit, and renews the token once when Asana refused it.
 */
@Injectable()
export class AsanaSyncService {
	private readonly logger = new Logger(AsanaSyncService.name);
	private readonly sectionsCache = new Map<string, { at: number; sections: AsanaSection[] }>();
	/** The pushes of each platform task, one after the other. */
	private readonly pushChains = new Map<string, Promise<void>>();
	/** The applies of each Asana task, one after the other. */
	private readonly applyChains = new Map<string, Promise<unknown>>();
	/** The apply slots: how many applies may hold a transaction at once here (`withApplySlot`). */
	private applySlotsFree = ASANA_APPLY_CONCURRENCY;
	private readonly applyWaiters: Array<() => void> = [];

	constructor(
		private readonly commandBus: CommandBus,
		private readonly tenants: AsanaTenantService,
		private readonly mappings: AsanaMappingService,
		private readonly runs: AsanaSyncRunService,
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		private readonly integrationMapService: IntegrationMapService,
		private readonly integrationTenantSyncService: IntegrationTenantSyncService,
		private readonly taskDetails: AsanaTaskDetailsService,
		private readonly conflicts: AsanaSyncConflictService,
		@Inject(ASANA_CONFIG) private readonly config: AsanaConfig
	) {}

	// ---------------------------------------------------------------- webhooks

	/**
	 * Registers Asana's webhook on the mapping's project (best effort: without a public address, or when Asana
	 * refuses, the mapping syncs by imports). Asana calls the receiver with the handshake while this runs: the
	 * target carries a single-use token, and the receiver accepts the handshake — and stores the secret on the
	 * mapping — only with that token while the registration is in flight; the token is dropped either way.
	 */
	async ensureWebhook(tenant: IIntegrationTenant, mapping: AsanaProjectMapping): Promise<void> {
		const token = randomBytes(24).toString('hex');
		const target = asanaWebhookTargetOf(this.config, mapping.id as string, token);
		if (!target || mapping.webhookGid) return;
		try {
			await this.mappings.startHandshake(mapping, token);
			const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
			const webhook = await this.call(holder, (client) => client.createWebhook(mapping.asanaProjectGid, target));
			// The handshake wrote the secret; the gid is written here (the secret stays as the handshake left it).
			const current = await this.mappings.findAnyById(mapping.id as ID);
			await this.mappings.recordWebhook(mapping, { gid: webhook.gid, secret: current?.webhookSecret ?? mapping.webhookSecret ?? null });
		} catch (caught) {
			this.logger.warn(`The Asana webhook of mapping ${mapping.id} could not be registered: ${this.describe(caught)}`);
		} finally {
			await this.mappings.startHandshake(mapping, null).catch(() => undefined);
		}
	}

	/** Removes the mapping's webhook on Asana (best effort). */
	/** Removes the mapping's webhook from Asana; `true` when it is gone (or there was none), `false` when Asana still has it. */
	async removeWebhook(tenant: IIntegrationTenant, mapping: AsanaProjectMapping): Promise<boolean> {
		if (!mapping.webhookGid) return true;
		try {
			const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
			await this.call(holder, (client) => client.deleteWebhook(mapping.webhookGid as string));
			return true;
		} catch (caught) {
			this.logger.warn(`The Asana webhook of mapping ${mapping.id} could not be removed: ${this.describe(caught)}`);
			return false;
		}
	}

	// ---------------------------------------------------------------- inbound: import

	/**
	 * Imports the mapping's tasks into a claimed run: every page of them (changed since the watermark unless
	 * `full`), streamed — each page applied before the next is read, however many there are — each one a task
	 * created or updated, subtasks linked to their parents at the end. The watermark moves only when every task
	 * went through and every page was read. The run row is always finished.
	 */
	async importMapping(tenant: IIntegrationTenant, mapping: AsanaProjectMapping, run: AsanaSyncRun, options: { full?: boolean } = {}): Promise<void> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const user = asanaSyncUser(scope, this.connectedByUserId(tenant) ?? run.requestedByUserId ?? null);
		const counts = emptyCounts();
		const since = options.full ? null : mapping.lastCursor ?? null;
		// The next import starts a little before this run did: Asana's pages are not ordered by `modified_at`, so a task
		// changed while they were read would otherwise sit below the newest change read and be skipped next time.
		// Reading a few tasks again is harmless (the apply is idempotent through the id map).
		const cursor = new Date(Date.now() - ASANA_IMPORT_CLOCK_SKEW_MS).toISOString();
		let error: string | null = null;
		try {
			await runInAsanaContext(user, async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				let offset: string | null = null;
				for (;;) {
					const page = await this.call(context, (client) => client.tasks(mapping.asanaProjectGid, { modifiedSince: since, offset, limit: ASANA_TASKS_PAGE_SIZE }));
					for (const task of page.items) {
						await this.applyOne(context, task);
					}
					await this.runs.progress(run, counts);
					if (!page.nextOffset) break;
					offset = page.nextOffset;
				}
				await this.linkParents(context);
				this.reportDetails(context);
			});
			if (counts.failed > 0) {
				error = `${counts.failed} task(s) could not be applied; the import position was kept so the next import reads them again.`;
			}
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof AsanaApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[AsanaSettingName.ACCESS_TOKEN] ?? null);
			}
			this.logger.warn(`Import of mapping ${mapping.id} failed: ${error}`);
		} finally {
			try {
				await this.mappings.recordImport(mapping, { cursor: error ? undefined : cursor, error });
			} catch (caught) {
				error = error ?? this.describe(caught);
				this.logger.warn(`The import position of mapping ${mapping.id} could not be written: ${this.describe(caught)}`);
			}
			await this.runs.finish(run, { counts, cursor: error ? since : cursor, error }).catch((caught: unknown) => {
				this.logger.warn(`Run ${run.id} could not be finished: ${this.describe(caught)}`);
			});
		}
		if (!error) {
			await this.integrationTenantSyncService
				.recordSyncCompleted(tenant.id as ID, { tenantId: scope.tenantId, organizationId: scope.organizationId, counts: { task: counts.created + counts.updated } })
				.catch((caught: unknown) => this.logger.warn(`The sync completion of ${tenant.id} could not be recorded: ${this.describe(caught)}`));
		}
	}

	// ---------------------------------------------------------------- inbound: webhook

	/**
	 * Applies the tasks a webhook delivery named (read again from Asana: an event carries ids), through the
	 * mapping's project. The import watermark is not touched. Answers how many were applied, or why not.
	 */
	async applyTasksFromWebhook(tenant: IIntegrationTenant, mapping: AsanaProjectMapping, taskGids: string[]): Promise<{ applied: number; error: string | null }> {
		if (!taskGids.length || !mapping.syncEnabled || mapping.direction === 'outbound') return { applied: 0, error: null };
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const run = await this.runs.startWebhookRun(tenant, mapping.id as ID);
		const counts = emptyCounts();
		let error: string | null = null;
		try {
			await runInAsanaContext(asanaSyncUser(scope, this.connectedByUserId(tenant)), async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				for (const gid of taskGids) {
					const task = await this.call(context, (client) => client.task(gid));
					if (!task || !(await this.belongsToProject(context, task))) {
						counts.skipped += 1;
						continue;
					}
					await this.applyOne(context, task);
				}
				await this.linkParents(context);
				this.reportDetails(context);
			});
			if (counts.failed > 0) error = `${counts.failed} task(s) could not be applied.`;
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof AsanaApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[AsanaSettingName.ACCESS_TOKEN] ?? null);
			}
			this.logger.warn(`Webhook tasks of mapping ${mapping.id} failed: ${error}`);
		} finally {
			await this.runs.finish(run, { counts, cursor: mapping.lastCursor ?? null, error }).catch(() => undefined);
		}
		return { applied: counts.created + counts.updated, error };
	}

	// ---------------------------------------------------------------- outbound

	/**
	 * Sends a platform task's changes to its Asana task, or creates one when the project's mapping sends new
	 * tasks out. The saved task is read again by id; the pushes of one task run one after the other. Never throws.
	 */
	pushTask(taskId: ID, tenantId: ID): Promise<void> {
		const key = String(taskId);
		const previous = this.pushChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.pushTaskNow(taskId, tenantId))
			.catch((caught: unknown) => this.logger.warn(`Task ${taskId} could not be sent to Asana: ${this.describe(caught)}`))
			.finally(() => {
				if (this.pushChains.get(key) === next) this.pushChains.delete(key);
			});
		this.pushChains.set(key, next);
		return next;
	}

	private async pushTaskNow(taskId: ID, tenantId: ID): Promise<void> {
		const task = await this.dataSource.getRepository(Task).findOne({ where: { id: taskId, tenantId } as never });
		if (!task?.projectId || !task.organizationId || !isTaskSyncAllowed(task, 'third-party')) return;
		const scope = { tenantId, organizationId: task.organizationId as ID };
		const mapping = await this.mappings.findOutboundForProject(scope, task.projectId as ID);
		if (!mapping) return;
		// The task's tenant is the trusted one (an event may carry no request context): the connection must be its.
		const tenant = await this.tenants.findAnyById(mapping.integrationId);
		if (!tenant || tenant.tenantId !== tenantId) return;
		const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
		try {
			const sectionMap = parseSectionMap(mapping.sectionMap);
			const sections = await this.projectSections(holder, mapping.integrationId, mapping.asanaProjectGid);
			const input = asanaUpdateOf(task);
			const section = sectionForStatus(task.status, sectionMap, sections);
			const existing = await this.findTaskMap(task.id as ID, mapping.integrationId, scope);
			if (existing?.sourceId) {
				await this.call(holder, (client) => client.updateTask(existing.sourceId, input));
				if (section) await this.call(holder, (client) => client.moveToSection(section.gid, existing.sourceId));
				return;
			}
			if (!input.name) return;
			await this.createTaskOnce(holder, mapping, task.id as ID, scope, { ...input, name: input.name, projectGid: mapping.asanaProjectGid, sectionGid: section?.gid ?? null });
		} catch (caught) {
			if (caught instanceof AsanaApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[AsanaSettingName.ACCESS_TOKEN] ?? null);
			}
			throw caught;
		}
	}

	/**
	 * Creates the Asana task of a platform task and records its id map: the task is created outside any
	 * transaction; the map is written in a short transaction that holds the new task's source lock (the one an
	 * inbound apply of that gid takes, in this process and on Postgres) and the platform task's, and looks again.
	 * When another process recorded a map for the platform task meanwhile, the Asana task just created is
	 * completed and renamed as a duplicate (Asana has no archive for tasks). When the webhook Asana sent for the
	 * new task got there first and made a platform task of it, that map is pointed at this task and the task the
	 * webhook made is removed.
	 */
	private async createTaskOnce(
		holder: ClientHolder,
		mapping: AsanaProjectMapping,
		taskId: ID,
		scope: { tenantId: ID; organizationId: ID },
		input: Parameters<AsanaApiClient['createTask']>[0]
	): Promise<void> {
		const created = await this.call(holder, (client) => client.createTask(input));
		const integrationId = mapping.integrationId;
		const sourceKey = `${integrationId}:${created.gid}`;
		const outcome = await this.serialized(sourceKey, () =>
			this.withApplySlot(() =>
				this.lockedTransaction([`integration-asana:task:${sourceKey}`, `integration-asana:task:${taskId}`], async (manager): Promise<'recorded' | 'duplicate' | 'reconciled'> => {
				const byTask = await manager.findOne(IntegrationMap, {
					where: { entity: IntegrationEntity.TASK, gauzyId: taskId, integrationId, ...scope } as never
				});
				if (byTask) return 'duplicate';
				const bySource = await manager.findOne(IntegrationMap, {
					where: { entity: IntegrationEntity.TASK, sourceId: created.gid, integrationId, ...scope } as never
				});
				if (bySource) {
					await manager.update(IntegrationMap, { id: bySource.id }, { gauzyId: taskId } as never);
					if (bySource.gauzyId && bySource.gauzyId !== taskId) {
						await manager.softDelete(Task, { id: bySource.gauzyId, tenantId: scope.tenantId } as never);
					}
					return 'reconciled';
				}
				await manager.save(
					IntegrationMap,
					Object.assign(new IntegrationMap(), { entity: IntegrationEntity.TASK, gauzyId: taskId, sourceId: created.gid, integrationId, ...scope })
				);
				return 'recorded';
				})
			)
		);
		if (outcome === 'duplicate') {
			await this.call(holder, (client) => client.updateTask(created.gid, { name: `[duplicate] ${created.name}`, completed: true })).catch((caught: unknown) => {
				this.logger.warn(`Asana task ${created.gid} was created twice for task ${taskId} and could not be closed: ${this.describe(caught)}`);
			});
		} else if (outcome === 'reconciled') {
			this.logger.warn(`Task ${taskId}: the task the webhook of Asana task ${created.gid} made meanwhile was removed as a duplicate.`);
		}
	}

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

	/**
	 * Runs `work` holding one of the apply slots: an apply holds its transaction's pool connection while the
	 * platform's commands use others, so at most `ASANA_APPLY_CONCURRENCY` applies run at once in a process and
	 * a burst of deliveries cannot take the pool from the API's requests. Waiters are served in order.
	 */
	private async withApplySlot<T>(work: () => Promise<T>): Promise<T> {
		if (this.applySlotsFree > 0 && this.applyWaiters.length === 0) this.applySlotsFree -= 1;
		else await new Promise<void>((resolve) => this.applyWaiters.push(resolve));
		try {
			return await work();
		} finally {
			const next = this.applyWaiters.shift();
			if (next) next();
			else this.applySlotsFree += 1;
		}
	}

	/** Runs `work` after whatever runs for `key` in this process (the lock across processes is the caller's). */
	private serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
		const previous = this.applyChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(work)
			.finally(() => {
				if (this.applyChains.get(key) === next) this.applyChains.delete(key);
			});
		this.applyChains.set(key, next);
		return next;
	}

	// ---------------------------------------------------------------- one Asana task

	private async openContext(tenant: IIntegrationTenant, mapping: AsanaProjectMapping, counts: AsanaSyncCounts, runId: ID | null): Promise<ApplyContext> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const where = [{ ...scope, projectId: mapping.projectId }, { ...scope, projectId: IsNull() }];
		const [statuses, priorities] = await Promise.all([
			this.dataSource.getRepository(TaskStatus).find({ where: where as never }).catch(() => [] as TaskStatus[]),
			this.dataSource.getRepository(TaskPriority).find({ where: where as never }).catch(() => [] as TaskPriority[])
		]);
		// A project's own status wins over the organization's of the same name; names compare by key (`statusKey`).
		const orderedStatuses = [...statuses].sort((a, b) => (a.projectId ? 0 : 1) - (b.projectId ? 0 : 1));
		const knownStatuses = knownStatusesOf(orderedStatuses.map((status) => status.name));
		const statusIdsByName = new Map<string, ID>();
		for (const status of orderedStatuses) {
			const key = statusKey(status.name);
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
			sectionMap: parseSectionMap(mapping.sectionMap),
			knownStatuses,
			statusIdsByName,
			priorityIdsByName,
			employeeIdsByEmail: new Map(),
			tagIdsByAsanaGid: new Map(),
			pendingParents: [],
			applied: new Set(),
			connectedByUserId: this.connectedByUserId(tenant),
			authorsByEmail: new Map(),
			details: { comments: 0, links: 0, failed: 0 },
			counts
		};
	}

	/**
	 * One Asana task of a run, then its subtasks: a subtask is in the project only when someone added it, so the
	 * project's pages do not carry it — it is read through its parent (`num_subtasks`), as far down as
	 * `ASANA_SUBTASK_MAX_DEPTH`. A failure counts and is logged; a refused token stops the run.
	 */
	private async applyOne(context: ApplyContext, task: AsanaTask, depth = 0): Promise<void> {
		if (context.applied.has(task.gid)) return;
		context.applied.add(task.gid);
		let taskId: ID | null = null;
		try {
			const result = await this.applyTask(context, task);
			context.counts[result.outcome] += 1;
			taskId = result.taskId;
		} catch (caught) {
			if (caught instanceof AsanaApiError) throw caught;
			context.counts.failed += 1;
			this.logger.warn(`Asana task ${task.gid} could not be applied: ${this.describe(caught)}`);
		}
		// Behind the task itself: its comments and attachments — read apart (two calls, no lock held while Asana answers),
		// then kept one run at a time per task under the task's own lock: a webhook and an import that meet on one task
		// would otherwise both find no mapped comment and keep it twice.
		if (taskId) {
			const detailsContext = this.detailsContextOf(context);
			const details = await this.taskDetails.collect(detailsContext, task);
			const key = `${context.mapping.integrationId}:${task.gid}`;
			const resolvedTaskId = taskId;
			try {
				await this.serialized(`${key}:details`, () =>
					this.withApplySlot(() => this.lockedTransaction([`integration-asana:task-details:${key}`], () => this.taskDetails.apply(detailsContext, task, details, resolvedTaskId)))
				);
			} catch (caught) {
				// The API's refusal is the run's; a lock that could not be taken, or a store error, is this task's details failing, and the run goes on.
				if (caught instanceof AsanaApiError) throw caught;
				context.details.failed += 1;
				this.logger.warn(`The details of task ${task.gid} could not be kept: ${this.describe(caught)}`);
			}
		}
		if (!(task.num_subtasks && task.num_subtasks > 0) || depth >= ASANA_SUBTASK_MAX_DEPTH || task.resource_subtype === 'section') return;
		let subtasks: AsanaTask[];
		try {
			subtasks = await this.call(context, (client) => client.subtasks(task.gid));
		} catch (caught) {
			if (caught instanceof AsanaApiError && caught.isUnauthorized) throw caught;
			this.logger.warn(`The subtasks of Asana task ${task.gid} could not be read: ${this.describe(caught)}`);
			return;
		}
		for (const subtask of subtasks) {
			await this.applyOne(context, subtask, depth + 1);
		}
	}

	/**
	 * Whether a task a webhook named is the mapping's: in the project itself, or a subtask whose parent chain reaches
	 * a task that is (a subtask is in the project only when someone added it, and its events name the subtask).
	 */
	private async belongsToProject(context: ApplyContext, task: AsanaTask): Promise<boolean> {
		let current: AsanaTask | null = task;
		for (let depth = 0; current && depth <= ASANA_SUBTASK_MAX_DEPTH; depth += 1) {
			if ((current.memberships ?? []).some((membership) => membership?.project?.gid === context.mapping.asanaProjectGid)) return true;
			if (!current.parent?.gid) return false;
			const parentGid: string = current.parent.gid;
			current = await this.call(context, (client) => client.task(parentGid));
		}
		return false;
	}

	/** One apply at a time per Asana task: chained in the process, locked across processes (`lockedTransaction`), within the process's apply slots. */
	private applyTask(context: ApplyContext, task: AsanaTask): Promise<ApplyResult> {
		const key = `${context.mapping.integrationId}:${task.gid}`;
		return this.serialized(key, () => this.withApplySlot(() => this.lockedTransaction([`integration-asana:task:${key}`], () => this.applyTaskNow(context, task))));
	}

	/**
	 * One Asana task → one platform task: created once, updated after, by the platform's id map. A relation whose
	 * lookup did not answer (the assignee by e-mail, a tag) is left as the task has it; an empty value clears it.
	 * The synced fields of a mapped task are merged three ways with what both sides last agreed on: a field changed
	 * only on the platform keeps the task's value, one changed on both sides takes Asana's and records the task's as a
	 * conflict.
	 */
	private async applyTaskNow(context: ApplyContext, task: AsanaTask): Promise<ApplyResult> {
		const { scope, mapping } = context;
		const integrationId = mapping.integrationId;
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.TASK, sourceId: task.gid, integrationId, ...scope })
			.catch(() => null);
		// A section header is not a task.
		if (task.resource_subtype === 'section') return { outcome: 'skipped', taskId: null };
		// An Asana task two mapped projects share belongs to the mapping that imported it first: another leaves it
		// alone rather than moving it between the platform's projects on every import.
		if (existing?.gauzyId) {
			const owner = await this.dataSource
				.getRepository(Task)
				.findOne({ where: { id: existing.gauzyId, tenantId: scope.tenantId } as never, select: { id: true, projectId: true } as never })
				.catch(() => null);
			if (owner?.projectId && owner.projectId !== mapping.projectId) return { outcome: 'skipped', taskId: null };
		}
		const fields = taskFieldsOf(task, mapping.asanaProjectGid, context.sectionMap, context.knownStatuses);
		const external = syncedValuesOf(fields);
		const merge = await this.conflicts.prepare({ ...scope, integrationId, sourceId: task.gid, taskId: (existing?.gauzyId as ID | undefined) ?? null, external });
		const members = await this.membersOf(context, task.assignee?.email ?? null);
		const tags = await this.tagsOf(context, task.tags ?? []);
		const entity = {
			...scope,
			projectId: mapping.projectId,
			title: fields.title,
			description: fields.description,
			status: fields.status,
			taskStatusId: context.statusIdsByName.get(statusKey(fields.status)) ?? null,
			priority: fields.priority ?? null,
			taskPriorityId: fields.priority ? context.priorityIdsByName.get(fields.priority.toLowerCase()) ?? null : null,
			dueDate: fields.dueDate,
			...(members === undefined ? {} : { members }),
			...(tags === undefined ? {} : { tags }),
			...(task.parent?.gid ? {} : { parentId: null })
		};
		const write = withoutKeptFields(entity as Record<string, unknown>, merge?.keepPlatform ?? []) as unknown as ITaskCreateInput | ITaskUpdateInput;
		// The conflicts are recorded while the task still holds its own values: a failure after the write cannot lose them.
		const recorded = await this.conflicts.record({ ...scope, integrationId, mappingId: mapping.id as ID, runId: context.runId, sourceId: task.gid, merge });
		let map: IIntegrationMap;
		try {
			map = await this.commandBus.execute(new IntegrationMapSyncTaskCommand({ entity: write, sourceId: task.gid, integrationId, ...scope }, false));
		} catch (caught) {
			// Not written: the task keeps its values, and the conflicts recorded for them are taken back.
			await this.conflicts
				.discard(recorded)
				.catch((error: unknown) => this.logger.warn(`The conflicts recorded for Asana task ${task.gid} could not be taken back: ${this.describe(error)}`));
			throw caught;
		}
		if (map?.gauzyId) {
			// The Asana task's values become what both sides agreed on; a failure here fails the Asana task (its conflicts stay recorded) and the next import writes it again.
			await this.conflicts.settle({ ...scope, integrationId, sourceId: task.gid, taskId: map.gauzyId as ID, external, recorded });
			context.conflicts += recorded.length;
		}
		if (task.parent?.gid && map?.gauzyId) {
			context.pendingParents.push({ taskId: map.gauzyId as ID, parentSourceId: task.parent.gid });
		}
		return { outcome: existing ? 'updated' : 'created', taskId: (map?.gauzyId as ID | undefined) ?? null };
	}

	/** Subtasks point at their parent's task once every task of the run is in. */
	private async linkParents(context: ApplyContext): Promise<void> {
		for (const pending of context.pendingParents.splice(0)) {
			const parent = await this.integrationMapService
				.findOneByWhereOptions({ entity: IntegrationEntity.TASK, sourceId: pending.parentSourceId, integrationId: context.mapping.integrationId, ...context.scope })
				.catch(() => null);
			if (!parent?.gauzyId || parent.gauzyId === pending.taskId) continue;
			await this.commandBus
				.execute(new TaskUpdateCommand(pending.taskId, { ...context.scope, parentId: parent.gauzyId as ID } as ITaskUpdateInput, false))
				.catch((caught: unknown) => this.logger.warn(`Task ${pending.taskId} could not be linked to its parent: ${this.describe(caught)}`));
		}
	}

	/** What the details import needs of a run: its scope, the connection's reads, and the run's own caches and tallies. */
	private detailsContextOf(context: ApplyContext) {
		return {
			scope: context.scope,
			integrationId: context.mapping.integrationId,
			connectedByUserId: context.connectedByUserId,
			read: <T>(make: (client: AsanaApiClient) => Promise<T>) => this.call(context, make),
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
			this.logger.log(`Mapping ${context.mapping.id}: ${context.conflicts} field(s) changed on both sides; Asana's value applied, the task's recorded as a conflict`);
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

	/** The task's members for the Asana assignee: by e-mail, nobody when there is none, `undefined` when the lookup failed. */
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
			this.logger.warn(`The employee of ${key} could not be looked up: ${this.describe(caught)}`);
			return undefined;
		}
		const id = context.employeeIdsByEmail.get(key);
		return id ? [{ id }] : [];
	}

	/** The task's tags for the Asana tags: one per tag, created once by the platform's label sync; `undefined` when a sync failed. */
	private async tagsOf(context: ApplyContext, tags: AsanaTag[]): Promise<Array<{ id: ID }> | undefined> {
		const ids: ID[] = [];
		for (const tag of tags) {
			if (!tag?.gid || !tag.name) continue;
			if (!context.tagIdsByAsanaGid.has(tag.gid)) {
				try {
					// The label sync answers the tag itself (created once, updated after), not its id map.
					const synced: ITag = await this.commandBus.execute(
						new IntegrationMapSyncLabelCommand({
							entity: { name: tag.name, color: asanaColorOf(tag.color), ...context.scope } as never,
							sourceId: tag.gid,
							integrationId: context.mapping.integrationId,
							...context.scope
						})
					);
					context.tagIdsByAsanaGid.set(tag.gid, (synced?.id as ID | undefined) ?? null);
				} catch (caught) {
					this.logger.warn(`Tag ${tag.name} could not be synced: ${this.describe(caught)}`);
					return undefined;
				}
			}
			const id = context.tagIdsByAsanaGid.get(tag.gid);
			if (id) ids.push(id);
		}
		return ids.map((id) => ({ id }));
	}

	// ---------------------------------------------------------------- helpers

	private async findTaskMap(taskId: ID, integrationId: ID, scope: { tenantId: ID; organizationId: ID }): Promise<IIntegrationMap | null> {
		return this.integrationMapService.findOneByWhereOptions({ entity: IntegrationEntity.TASK, gauzyId: taskId, integrationId, ...scope }).catch(() => null);
	}

	private async projectSections(holder: ClientHolder, integrationId: ID, projectGid: string): Promise<AsanaSection[]> {
		const key = `${integrationId}:${projectGid}`;
		const cached = this.sectionsCache.get(key);
		if (cached && Date.now() - cached.at < SECTIONS_TTL_MS) return cached.sections;
		const sections = await this.call(holder, (client) => client.sections(projectGid));
		this.sectionsCache.set(key, { at: Date.now(), sections });
		return sections;
	}

	/** One call to Asana: a rate limit waited out once, a refused token renewed once, then the call made again. */
	private async call<T>(holder: ClientHolder, make: (client: AsanaApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(holder.client);
		} catch (caught) {
			if (caught instanceof AsanaApiError && caught.isRateLimited) {
				await sleep(Math.min(Math.max((caught.retryAfterSeconds ?? 5) * 1000, 1000), RATE_LIMIT_MAX_WAIT_MS));
				return make(holder.client);
			}
			if (caught instanceof AsanaApiError && caught.isUnauthorized && !holder.renewed) {
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
		const value = this.tenants.settingsOf(tenant)[AsanaSettingName.CONNECTED_BY_USER_ID];
		return value ? (value as ID) : null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}

/** Asana names its tag colours (`dark-pink`, `light-blue`, …); a hex the platform's tags take. */
function asanaColorOf(color: string | null | undefined): string {
	const named: Record<string, string> = {
		'dark-pink': '#E8384F',
		'dark-green': '#62D26F',
		'dark-blue': '#4186E0',
		'dark-red': '#E8384F',
		'dark-teal': '#20AAEA',
		'dark-brown': '#AA62E3',
		'dark-orange': '#FD9A00',
		'dark-purple': '#7A6FF0',
		'dark-warm-gray': '#8DA3A6',
		'light-pink': '#F9AAEF',
		'light-green': '#B6E3B6',
		'light-blue': '#9CC7FF',
		'light-red': '#FFA6A6',
		'light-teal': '#8EE8FD',
		'light-yellow': '#FFE275',
		'light-orange': '#FFC36E',
		'light-purple': '#C8A9FF',
		'light-warm-gray': '#D2D9DB',
		none: '#6E7681'
	};
	return (color && named[color]) || '#6E7681';
}
