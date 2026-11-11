import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
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
	withoutKeptFields
} from '@gauzy/core';
import { TrelloApiClient, TrelloApiError, TrelloCard, TrelloLabel, TrelloList } from '../client/trello-api.client';
import { TrelloSyncRun } from '../entities/trello-sync-run.entity';
import { TrelloBoardMapping } from '../entities/trello-board-mapping.entity';
import { TrelloConfig, trelloWebhookTargetOf } from '../trello-config';
import { TrelloMappingService } from '../trello-mapping.service';
import { trelloSyncUser, runInTrelloContext } from '../trello-process';
import { TrelloSyncConflictService } from '../trello-sync-conflict.service';
import { emptyCounts, TrelloSyncCounts, TrelloSyncRunService } from '../trello-sync-run.service';
import { TrelloTenantService } from '../trello-tenant.service';
import { TRELLO_APPLY_CONCURRENCY, TRELLO_CARDS_PAGE_SIZE, TRELLO_CONFIG, TRELLO_IMPORT_CLOCK_SKEW_MS, TrelloSettingName } from '../trello.constants';
import { TrelloCardDetailsService } from './trello-card-details.service';
import { isChangedSince, knownStatusesOf, listForStatus, parseListMap, statusKey, taskFieldsOf, trelloColorOf, trelloUpdateOf } from './trello-card.mapper';

/** What one card became. */
type ApplyOutcome = 'created' | 'updated' | 'skipped';
/** What one card became, and the platform task it is (none when skipped). */
interface ApplyResult {
	outcome: ApplyOutcome;
	taskId: ID | null;
}

/** A connection's client. */
interface ClientHolder {
	tenant: IIntegrationTenant;
	client: TrelloApiClient;
}

/** The caches of one run: the board's lists, the statuses and priorities of the project, the employees by Trello member, the tags by label. */
interface ApplyContext extends ClientHolder {
	mapping: TrelloBoardMapping;
	scope: { tenantId: ID; organizationId: ID };
	/** The run the items are applied in: the conflicts it finds name it. */
	runId: ID | null;
	/** How many fields changed on both sides in this run (Trello's value applied, the task's recorded). */
	conflicts: number;
	listMap: Record<string, string>;
	/** The board's lists by id → name (the status of a card in an unmapped list is its list's name, when that is a status). */
	listNames: Map<string, string>;
	/** The statuses a task may take, by key (`statusKey`) → the name as stored, and → the row's id. */
	knownStatuses: Map<string, string>;
	statusIdsByName: Map<string, ID>;
	priorityIdsByName: Map<string, ID>;
	employeeIdsByMember: Map<string, ID | null>;
	/** The organization's employees (with their user), loaded once per run when a member is first matched. */
	employees?: EmployeeLike[];
	tagIdsByLabel: Map<string, ID | null>;
	/** The user who connected: the comments nobody here wrote are theirs to own. */
	connectedByUserId: ID | null;
	/** What the details import brought in this run (comments, attachments as links): reported, not counted on the run. */
	details: { comments: number; links: number; failed: number };
	counts: TrelloSyncCounts;
}

/** What a member is matched against: the user's e-mail (its local part is Trello's username) and name. */
type EmployeeLike = { id?: ID; userId?: ID | null; user?: { email?: string | null; firstName?: string | null; lastName?: string | null; name?: string | null } | null };

const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** How long a board's lists are kept for outbound pushes. */
const LISTS_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The sync itself: an import of a mapped board's cards (every one, or those changed since the watermark), one
 * card from a webhook, and a platform task's changes sent back. Inbound writes go through the platform's
 * `IntegrationMapSyncTaskCommand` (one id map per card, a task created once and updated after) with
 * `triggeredEvent = false`, so nothing the sync writes is sent out again. Every call to Trello waits once for a
 * rate limit; a refused token marks the connection for a person (Trello's tokens are not renewable).
 */
@Injectable()
export class TrelloSyncService {
	private readonly logger = new Logger(TrelloSyncService.name);
	private readonly listsCache = new Map<string, { at: number; lists: TrelloList[] }>();
	/** The pushes of each platform task, one after the other. */
	private readonly pushChains = new Map<string, Promise<void>>();
	/** The applies of each card, one after the other. */
	private readonly applyChains = new Map<string, Promise<unknown>>();
	/** The apply slots: how many applies may hold a transaction at once here (`withApplySlot`). */
	private applySlotsFree = TRELLO_APPLY_CONCURRENCY;
	private readonly applyWaiters: Array<() => void> = [];

	constructor(
		private readonly commandBus: CommandBus,
		private readonly tenants: TrelloTenantService,
		private readonly mappings: TrelloMappingService,
		private readonly runs: TrelloSyncRunService,
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		private readonly integrationMapService: IntegrationMapService,
		private readonly integrationTenantSyncService: IntegrationTenantSyncService,
		private readonly cardDetails: TrelloCardDetailsService,
		private readonly conflicts: TrelloSyncConflictService,
		@Inject(TRELLO_CONFIG) private readonly config: TrelloConfig
	) {}

	// ---------------------------------------------------------------- webhooks

	/**
	 * Registers Trello's webhook on the mapping's board (best effort: without a public address or the secret, or
	 * when Trello refuses, the mapping syncs by imports). Trello sends a HEAD request to the receiver before it
	 * answers, so the receiver must be reachable now; every later delivery is signed with the application's secret.
	 */
	async ensureWebhook(tenant: IIntegrationTenant, mapping: TrelloBoardMapping): Promise<void> {
		const target = trelloWebhookTargetOf(this.config, mapping.id as string);
		if (!target || mapping.webhookId) return;
		try {
			const holder = this.holderOf(tenant);
			const webhook = await this.call(holder, (client) => client.createWebhook({ idModel: mapping.trelloBoardId, callbackURL: target, description: `Ever Gauzy mapping ${mapping.id}` }));
			await this.mappings.recordWebhook(mapping, webhook.id);
		} catch (caught) {
			await this.noteRefusedToken(tenant, caught);
			this.logger.warn(`The Trello webhook of mapping ${mapping.id} could not be registered: ${this.describe(caught)}`);
		}
	}

	/** Removes the mapping's webhook on Trello (best effort). */
	/** Removes the mapping's webhook from Trello; `true` when it is gone (or there was none), `false` when Trello still has it. */
	async removeWebhook(tenant: IIntegrationTenant, mapping: TrelloBoardMapping): Promise<boolean> {
		if (!mapping.webhookId) return true;
		try {
			await this.call(this.holderOf(tenant), (client) => client.deleteWebhook(mapping.webhookId as string));
			return true;
		} catch (caught) {
			this.logger.warn(`The Trello webhook of mapping ${mapping.id} could not be removed: ${this.describe(caught)}`);
			return false;
		}
	}

	// ---------------------------------------------------------------- inbound: import

	/**
	 * Imports the mapping's cards into a claimed run: every page of the board's cards (Trello pages by id, newest
	 * first), those changed since the watermark unless `full`, each one a task created or updated, the pages
	 * streamed — each applied before the next is read. The watermark moves only when every card went through and
	 * every page was read. The run row is always finished.
	 */
	async importMapping(tenant: IIntegrationTenant, mapping: TrelloBoardMapping, run: TrelloSyncRun, options: { full?: boolean } = {}): Promise<void> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const user = trelloSyncUser(scope, this.connectedByUserId(tenant) ?? run.requestedByUserId ?? null);
		const counts = emptyCounts();
		const since = options.full ? null : mapping.lastCursor ?? null;
		// The next import starts a little before this run did: Trello pages by id, not by activity, so a card changed
		// while the pages were read would otherwise sit below the newest activity read and be skipped next time.
		// Reading a few cards again is harmless (the apply is idempotent through the id map).
		const cursor = new Date(Date.now() - TRELLO_IMPORT_CLOCK_SKEW_MS).toISOString();
		let error: string | null = null;
		try {
			await runInTrelloContext(user, async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				let before: string | null = null;
				for (;;) {
					const page = await this.call(context, (client) => client.cards(mapping.trelloBoardId, { before, limit: TRELLO_CARDS_PAGE_SIZE }));
					for (const card of page.items) {
						if (!isChangedSince(card, since)) {
							counts.skipped += 1;
							continue;
						}
						await this.applyOne(context, card);
					}
					await this.runs.progress(run, counts);
					if (!page.nextBefore) break;
					before = page.nextBefore;
				}
				this.reportDetails(context);
			});
			if (counts.failed > 0) {
				error = `${counts.failed} card(s) could not be applied; the import position was kept so the next import reads them again.`;
			}
		} catch (caught) {
			error = this.describe(caught);
			await this.noteRefusedToken(tenant, caught);
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
	 * Applies the cards a webhook delivery named (read again from Trello: an action carries ids), through the
	 * mapping's project. The import watermark is not touched. Answers how many were applied, or why not.
	 */
	async applyCardsFromWebhook(tenant: IIntegrationTenant, mapping: TrelloBoardMapping, cardIds: string[]): Promise<{ applied: number; error: string | null }> {
		if (!cardIds.length || !mapping.syncEnabled || mapping.direction === 'outbound') return { applied: 0, error: null };
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const run = await this.runs.startWebhookRun(tenant, mapping.id as ID);
		const counts = emptyCounts();
		let error: string | null = null;
		try {
			await runInTrelloContext(trelloSyncUser(scope, this.connectedByUserId(tenant)), async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID);
				for (const id of cardIds) {
					const card = await this.call(context, (client) => client.card(id));
					if (!card || card.idBoard !== mapping.trelloBoardId) {
						counts.skipped += 1;
						continue;
					}
					await this.applyOne(context, card);
				}
				this.reportDetails(context);
			});
			if (counts.failed > 0) error = `${counts.failed} card(s) could not be applied.`;
		} catch (caught) {
			error = this.describe(caught);
			await this.noteRefusedToken(tenant, caught);
			this.logger.warn(`Webhook cards of mapping ${mapping.id} failed: ${error}`);
		} finally {
			await this.runs.finish(run, { counts, cursor: mapping.lastCursor ?? null, error }).catch(() => undefined);
		}
		return { applied: counts.created + counts.updated, error };
	}

	// ---------------------------------------------------------------- outbound

	/**
	 * Sends a platform task's changes to its card, or creates one when the project's mapping sends new tasks out.
	 * The saved task is read again by id; the pushes of one task run one after the other. Never throws.
	 */
	pushTask(taskId: ID, tenantId: ID): Promise<void> {
		const key = String(taskId);
		const previous = this.pushChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.pushTaskNow(taskId, tenantId))
			.catch((caught: unknown) => this.logger.warn(`Task ${taskId} could not be sent to Trello: ${this.describe(caught)}`))
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
		const holder = this.holderOf(tenant);
		try {
			const listMap = parseListMap(mapping.listMap);
			const lists = await this.boardLists(holder, mapping.integrationId, mapping.trelloBoardId);
			const input = trelloUpdateOf(task);
			const list = listForStatus(task.status, listMap, lists);
			const existing = await this.findTaskMap(task.id as ID, mapping.integrationId, scope);
			if (existing?.sourceId) {
				await this.call(holder, (client) => client.updateCard(existing.sourceId, { ...input, ...(list ? { idList: list.id } : {}) }));
				return;
			}
			if (!input.name) return;
			// A new card goes to the list of its status, else the board's first list.
			const target = list ?? lists[0];
			if (!target) return;
			await this.createCardOnce(holder, mapping, task.id as ID, scope, { idList: target.id, name: input.name, desc: input.desc, due: input.due ?? null, dueComplete: input.dueComplete });
		} catch (caught) {
			await this.noteRefusedToken(tenant, caught);
			throw caught;
		}
	}

	/**
	 * Creates the card of a platform task and records its id map: the card is created outside any transaction;
	 * the map is written in a short transaction that holds the new card's source lock (the one an inbound apply
	 * of that card takes, in this process and on Postgres) and the platform task's, and looks again. When another
	 * process recorded a map for the platform task meanwhile, the card just created is archived as a duplicate.
	 * When the webhook Trello sent for the new card got there first and made a platform task of it, that map is
	 * pointed at this task and the task the webhook made is removed.
	 */
	private async createCardOnce(
		holder: ClientHolder,
		mapping: TrelloBoardMapping,
		taskId: ID,
		scope: { tenantId: ID; organizationId: ID },
		input: Parameters<TrelloApiClient['createCard']>[0]
	): Promise<void> {
		const created = await this.call(holder, (client) => client.createCard(input));
		const integrationId = mapping.integrationId;
		const sourceKey = `${integrationId}:${created.id}`;
		const outcome = await this.serialized(sourceKey, () =>
			this.withApplySlot(() =>
				this.lockedTransaction([`integration-trello:card:${sourceKey}`, `integration-trello:task:${taskId}`], async (manager): Promise<'recorded' | 'duplicate' | 'reconciled'> => {
					const byTask = await manager.findOne(IntegrationMap, {
						where: { entity: IntegrationEntity.TASK, gauzyId: taskId, integrationId, ...scope } as never
					});
					if (byTask) return 'duplicate';
					const bySource = await manager.findOne(IntegrationMap, {
						where: { entity: IntegrationEntity.TASK, sourceId: created.id, integrationId, ...scope } as never
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
						Object.assign(new IntegrationMap(), { entity: IntegrationEntity.TASK, gauzyId: taskId, sourceId: created.id, integrationId, ...scope })
					);
					return 'recorded';
				})
			)
		);
		if (outcome === 'duplicate') {
			await this.call(holder, (client) => client.updateCard(created.id, { name: `[duplicate] ${created.name}`, closed: true })).catch((caught: unknown) => {
				this.logger.warn(`Card ${created.id} was created twice for task ${taskId} and could not be archived: ${this.describe(caught)}`);
			});
		} else if (outcome === 'reconciled') {
			this.logger.warn(`Task ${taskId}: the task the webhook of card ${created.id} made meanwhile was removed as a duplicate.`);
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
	 * platform's commands use others, so at most `TRELLO_APPLY_CONCURRENCY` applies run at once in a process and
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

	// ---------------------------------------------------------------- one card

	private async openContext(tenant: IIntegrationTenant, mapping: TrelloBoardMapping, counts: TrelloSyncCounts, runId: ID | null): Promise<ApplyContext> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		// The project's own statuses and priorities, and the organization's (no project) under them.
		const where = [{ ...scope, projectId: mapping.projectId }, { ...scope, projectId: IsNull() }];
		const holder = this.holderOf(tenant);
		const [statuses, priorities, lists] = await Promise.all([
			this.dataSource.getRepository(TaskStatus).find({ where: where as never }).catch(() => [] as TaskStatus[]),
			this.dataSource.getRepository(TaskPriority).find({ where: where as never }).catch(() => [] as TaskPriority[]),
			this.boardLists(holder, mapping.integrationId, mapping.trelloBoardId)
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
			...holder,
			mapping,
			scope,
			runId,
			conflicts: 0,
			listMap: parseListMap(mapping.listMap),
			listNames: new Map(lists.map((list) => [list.id, list.name])),
			knownStatuses,
			statusIdsByName,
			priorityIdsByName,
			employeeIdsByMember: new Map(),
			tagIdsByLabel: new Map(),
			connectedByUserId: this.connectedByUserId(tenant),
			details: { comments: 0, links: 0, failed: 0 },
			counts
		};
	}

	/** One card of a run, then its comments and attachments: a failure counts and is logged; a refused token stops the run. */
	private async applyOne(context: ApplyContext, card: TrelloCard): Promise<void> {
		let taskId: ID | null = null;
		try {
			const result = await this.applyCard(context, card);
			context.counts[result.outcome] += 1;
			taskId = result.taskId;
		} catch (caught) {
			if (caught instanceof TrelloApiError) throw caught;
			context.counts.failed += 1;
			this.logger.warn(`Card ${card.id} could not be applied: ${this.describe(caught)}`);
		}
		// Behind the card itself: its comments and attachments — read apart (two calls, no lock held while Trello answers),
		// then kept one run at a time per card under the card's own lock: a webhook and an import that meet on one card
		// would otherwise both find no mapped comment and keep it twice.
		if (taskId) {
			const detailsContext = this.detailsContextOf(context);
			const details = await this.cardDetails.collect(detailsContext, card);
			const key = `${context.mapping.integrationId}:${card.id}`;
			const resolvedTaskId = taskId;
			try {
				await this.serialized(`${key}:details`, () =>
					this.withApplySlot(() => this.lockedTransaction([`integration-trello:card-details:${key}`], () => this.cardDetails.apply(detailsContext, card, details, resolvedTaskId)))
				);
			} catch (caught) {
				// The API's refusal is the run's; a lock that could not be taken, or a store error, is this card's details failing, and the run goes on.
				if (caught instanceof TrelloApiError) throw caught;
				context.details.failed += 1;
				this.logger.warn(`The details of card ${card.id} could not be kept: ${this.describe(caught)}`);
			}
		}
	}

	/** One apply at a time per card: chained in the process, locked across processes (`lockedTransaction`), within the process's apply slots. */
	private applyCard(context: ApplyContext, card: TrelloCard): Promise<ApplyResult> {
		const key = `${context.mapping.integrationId}:${card.id}`;
		return this.serialized(key, () => this.withApplySlot(() => this.lockedTransaction([`integration-trello:card:${key}`], () => this.applyCardNow(context, card))));
	}

	/**
	 * One card → one platform task: created once, updated after, by the platform's id map. A relation whose lookup
	 * did not answer (a member, a label) is left as the task has it; an empty value clears it.
	 * The synced fields of a mapped task are merged three ways with what both sides last agreed on: a field changed
	 * only on the platform keeps the task's value, one changed on both sides takes Trello's and records the task's as a
	 * conflict.
	 */
	private async applyCardNow(context: ApplyContext, card: TrelloCard): Promise<ApplyResult> {
		const { scope, mapping } = context;
		const integrationId = mapping.integrationId;
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.TASK, sourceId: card.id, integrationId, ...scope })
			.catch(() => null);
		// A card moved to another mapped board belongs to the mapping that imported it first: another leaves it alone.
		if (existing?.gauzyId) {
			const owner = await this.dataSource
				.getRepository(Task)
				.findOne({ where: { id: existing.gauzyId, tenantId: scope.tenantId } as never, select: { id: true, projectId: true } as never })
				.catch(() => null);
			if (owner?.projectId && owner.projectId !== mapping.projectId) return { outcome: 'skipped', taskId: null };
		}
		const fields = taskFieldsOf(card, context.listNames, context.listMap, context.knownStatuses);
		const external = syncedValuesOf(fields);
		const merge = await this.conflicts.prepare({ ...scope, integrationId, sourceId: card.id, taskId: (existing?.gauzyId as ID | undefined) ?? null, external });
		const members = await this.membersOf(context, card.members ?? []);
		const tags = await this.tagsOf(context, card.labels ?? []);
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
			...(tags === undefined ? {} : { tags })
		};
		const write = withoutKeptFields(entity as Record<string, unknown>, merge?.keepPlatform ?? []) as unknown as ITaskCreateInput | ITaskUpdateInput;
		// The conflicts are recorded while the task still holds its own values: a failure after the write cannot lose them.
		const recorded = await this.conflicts.record({ ...scope, integrationId, mappingId: mapping.id as ID, runId: context.runId, sourceId: card.id, merge });
		let map: IIntegrationMap;
		try {
			map = await this.commandBus.execute(new IntegrationMapSyncTaskCommand({ entity: write, sourceId: card.id, integrationId, ...scope }, false));
		} catch (caught) {
			// Not written: the task keeps its values, and the conflicts recorded for them are taken back.
			await this.conflicts
				.discard(recorded)
				.catch((error: unknown) => this.logger.warn(`The conflicts recorded for card ${card.id} could not be taken back: ${this.describe(error)}`));
			throw caught;
		}
		if (map?.gauzyId) {
			// The card's values become what both sides agreed on; a failure here fails the card (its conflicts stay recorded) and the next import writes it again.
			await this.conflicts.settle({ ...scope, integrationId, sourceId: card.id, taskId: map.gauzyId as ID, external, recorded });
			context.conflicts += recorded.length;
		}
		return { outcome: existing ? 'updated' : 'created', taskId: (map?.gauzyId as ID | undefined) ?? null };
	}

	/**
	 * The task's members for the card's members: Trello tells a member's username and full name (an e-mail only for
	 * the token's own member), so an employee is matched by a user e-mail starting with the username, else by the
	 * user's full name; nobody when none matches; `undefined` when a lookup failed.
	 */
	private async membersOf(context: ApplyContext, members: ReadonlyArray<{ id: string; username: string; fullName: string }>): Promise<Array<{ id: ID }> | undefined> {
		const ids: ID[] = [];
		for (const member of members) {
			if (!member?.id) continue;
			if (!context.employeeIdsByMember.has(member.id)) {
				try {
					context.employeeIdsByMember.set(member.id, await this.findEmployee(context, member));
				} catch (caught) {
					this.logger.warn(`The employee of Trello member ${member.username || member.id} could not be looked up: ${this.describe(caught)}`);
					return undefined;
				}
			}
			const id = context.employeeIdsByMember.get(member.id);
			if (id) ids.push(id);
		}
		return ids.map((id) => ({ id }));
	}

	/** What the details import needs of a run: its scope, the connection's reads, and the run's tallies. */
	private detailsContextOf(context: ApplyContext) {
		return {
			scope: context.scope,
			integrationId: context.mapping.integrationId,
			connectedByUserId: context.connectedByUserId,
			read: <T>(make: (client: TrelloApiClient) => Promise<T>) => this.call(context, make),
			details: context.details
		};
	}

	/**
	 * One line per run about the details, when there were any; what could not be read or kept counts as a failure
	 * of the run, so the import position is kept and the next import reads the task again.
	 */
	private reportDetails(context: ApplyContext): void {
		if (context.conflicts) {
			this.logger.log(`Mapping ${context.mapping.id}: ${context.conflicts} field(s) changed on both sides; Trello's value applied, the task's recorded as a conflict`);
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

	/** The employee a Trello member is: the organization's employees are loaded once per run and matched in memory. */
	private async findEmployee(context: ApplyContext, member: { username: string; fullName: string }): Promise<ID | null> {
		return (await this.findEmployeeRow(context, member))?.id ?? null;
	}

	/** The employee row (with its user) a Trello member is, by the user's e-mail starting with the username, else the full name. */
	private async findEmployeeRow(context: ApplyContext, member: { username: string; fullName: string }): Promise<EmployeeLike | null> {
		if (!context.employees) {
			const { items } = await this.employeeService.findAll({
				where: { ...context.scope, isActive: true, isArchived: false },
				relations: { user: true }
			} as never);
			context.employees = items as EmployeeLike[];
		}
		const items = context.employees;
		const username = member.username.trim().toLowerCase();
		const byEmail = username
			? items.find((employee) => String(employee.user?.email ?? '').toLowerCase().split('@')[0] === username)
			: undefined;
		// One trust rule for members and comment authors alike: a name a member chooses never matches an employee.
		return byEmail?.id ? byEmail : null;
	}

	/** The task's tags for the card's labels: one per label, created once by the platform's label sync; `undefined` when a sync failed. */
	private async tagsOf(context: ApplyContext, labels: TrelloLabel[]): Promise<Array<{ id: ID }> | undefined> {
		const ids: ID[] = [];
		for (const label of labels) {
			if (!label?.id) continue;
			// An unnamed label is its colour.
			const name = label.name?.trim() || (label.color ? `${label.color}` : '');
			if (!name) continue;
			if (!context.tagIdsByLabel.has(label.id)) {
				try {
					// The label sync answers the tag itself (created once, updated after), not its id map.
					const tag: ITag = await this.commandBus.execute(
						new IntegrationMapSyncLabelCommand({
							entity: { name, color: trelloColorOf(label.color), ...context.scope } as never,
							sourceId: label.id,
							integrationId: context.mapping.integrationId,
							...context.scope
						})
					);
					context.tagIdsByLabel.set(label.id, (tag?.id as ID | undefined) ?? null);
				} catch (caught) {
					this.logger.warn(`Label ${name} could not be synced: ${this.describe(caught)}`);
					return undefined;
				}
			}
			const id = context.tagIdsByLabel.get(label.id);
			if (id) ids.push(id);
		}
		return ids.map((id) => ({ id }));
	}

	// ---------------------------------------------------------------- helpers

	private holderOf(tenant: IIntegrationTenant): ClientHolder {
		return { tenant, client: this.tenants.clientFor(tenant) };
	}

	private async findTaskMap(taskId: ID, integrationId: ID, scope: { tenantId: ID; organizationId: ID }): Promise<IIntegrationMap | null> {
		return this.integrationMapService.findOneByWhereOptions({ entity: IntegrationEntity.TASK, gauzyId: taskId, integrationId, ...scope }).catch(() => null);
	}

	private async boardLists(holder: ClientHolder, integrationId: ID, boardId: string): Promise<TrelloList[]> {
		const key = `${integrationId}:${boardId}`;
		const cached = this.listsCache.get(key);
		if (cached && Date.now() - cached.at < LISTS_TTL_MS) return cached.lists;
		const lists = await this.call(holder, (client) => client.lists(boardId));
		this.listsCache.set(key, { at: Date.now(), lists });
		return lists;
	}

	/** One call to Trello: a rate limit waited out once, then the call made again. */
	private async call<T>(holder: ClientHolder, make: (client: TrelloApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(holder.client);
		} catch (caught) {
			if (caught instanceof TrelloApiError && caught.isRateLimited) {
				await sleep(Math.min(Math.max((caught.retryAfterSeconds ?? 10) * 1000, 1000), RATE_LIMIT_MAX_WAIT_MS));
				return make(holder.client);
			}
			throw caught;
		}
	}

	/** A refused token or key marks the connection for a person (Trello's tokens cannot be renewed here). */
	private async noteRefusedToken(tenant: IIntegrationTenant, caught: unknown): Promise<void> {
		if (caught instanceof TrelloApiError && caught.isUnauthorized) {
			await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[TrelloSettingName.TOKEN] ?? null);
		}
	}

	private connectedByUserId(tenant: IIntegrationTenant): ID | null {
		const value = this.tenants.settingsOf(tenant)[TrelloSettingName.CONNECTED_BY_USER_ID];
		return value ? (value as ID) : null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
