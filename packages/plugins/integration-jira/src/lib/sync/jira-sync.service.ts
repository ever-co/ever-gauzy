// cspell:ignore issuetype issuelinks duedate Cloners duplicat
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
	TaskLinkedIssue,
	TaskPriority,
	TaskStatus,
	TaskUpdateCommand,
	withoutKeptFields
} from '@gauzy/core';
import { importJqlOf, JiraApiClient, JiraApiError, JiraComment, JiraIssue, JiraIssueType, JiraPriority } from '../client/jira-api.client';
import { JiraProjectMapping } from '../entities/jira-project-mapping.entity';
import { JiraSyncRun } from '../entities/jira-sync-run.entity';
import { JiraCloudConfig } from '../jira-config';
import { JiraMappingService } from '../jira-mapping.service';
import { jiraSyncUser, runInJiraContext } from '../jira-process';
import { JiraSyncConflictService } from '../jira-sync-conflict.service';
import { emptyCounts, emptyReport, JiraSyncCounts, JiraSyncRunReport, JiraSyncRunService } from '../jira-sync-run.service';
import { JiraTenantService } from '../jira-tenant.service';
import {
	JIRA_COMMENTS_PAGE_SIZE,
	JIRA_CONFIG,
	JIRA_IMPORT_CLOCK_SKEW_MS,
	JIRA_IMPORT_MAX_ISSUES,
	JIRA_ISSUE_COMMENTS_MAX,
	JIRA_ISSUES_PAGE_SIZE,
	JIRA_REPORT_MAX_FAILURES,
	JiraSettingName
} from '../jira.constants';
import { JiraAuthor, JiraIssueDetailsService } from './jira-issue-details.service';
import {
	chooseCreateIssueType,
	chooseTransition,
	isIssueTypeAllowed,
	issueUpdateOf,
	JiraStatusMap,
	linkEndsOf,
	parseIssueTypeIds,
	parseStatusMap,
	taskFieldsOf
} from './jira-issue.mapper';

/** What one issue became. */
type ApplyOutcome = 'created' | 'updated' | 'skipped';
/** What one issue became, and the platform task it is (none when skipped). */
interface ApplyResult {
	outcome: ApplyOutcome;
	taskId: ID | null;
}

/** A connection's client, replaced once when Jira refused the token and a renewal worked. */
interface ClientHolder {
	tenant: IIntegrationTenant;
	client: JiraApiClient;
	renewed: boolean;
}

/** A link between two issues, recorded once both ends are tasks. */
interface PendingRelation {
	fromSourceId: string;
	toSourceId: string;
	action: number;
	/** When the issue it was read from changed (ISO): a link that could not be recorded keeps the import position there. */
	updated?: string | null;
}

/** The caches of one run: the statuses and priorities of the project, the employees by e-mail, the tags by label. */
interface ApplyContext extends ClientHolder {
	mapping: JiraProjectMapping;
	scope: { tenantId: ID; organizationId: ID };
	/** The run the issues are applied in: the conflicts it finds name it. */
	runId: ID | null;
	/** How many fields changed on both sides in this run (Jira's value applied, the task's recorded). */
	conflicts: number;
	statusMap: JiraStatusMap;
	/** The issue types the mapping takes (null: every type). */
	issueTypeIds: string[] | null;
	statusIdsByName: Map<string, ID>;
	priorityIdsByName: Map<string, ID>;
	employeeIdsByEmail: Map<string, ID | null>;
	tagIdsByLabel: Map<string, ID | null>;
	/** Children whose parent is linked once every issue of the run is in (with when the child changed, ISO). */
	pendingParents: Array<{ taskId: ID; parentSourceId: string; updated?: string | null }>;
	/** The change time (ISO) of the earliest issue whose parent or link could not be recorded: the next import reads it again. */
	linkFailedUpdated?: string | null;
	/** Issue links recorded once every issue of the run is in. */
	pendingRelations: PendingRelation[];
	/** The user who connected: the comments nobody here wrote are theirs to own. */
	connectedByUserId: ID | null;
	/** The comment authors by e-mail, once per run. */
	authorsByEmail: Map<string, JiraAuthor | null>;
	/** What the details import brought in this run (comments, attachments as links): reported, not counted on the run. */
	details: { comments: number; links: number; failed: number };
	counts: JiraSyncCounts;
	report: JiraSyncRunReport;
}

/** An issue update without its description (left as Jira has it). */
function withoutDescription<T extends { description?: unknown }>(fields: T): T {
	const rest = { ...fields };
	delete rest.description;
	return rest;
}

/** A later claim failed the run as abandoned: its import stops and writes neither the position nor its outcome. */
class JiraRunSuperseded extends Error {
	constructor(runId: ID) {
		super(`Run ${runId} was failed as abandoned by a later claim of its mapping`);
		this.name = 'JiraRunSuperseded';
	}
}

/** A lookup that did not answer: the task's relation is left as it is, not emptied. */
class ResolutionFailed extends Error {
	constructor(what: string, cause: unknown) {
		super(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`);
		this.name = 'ResolutionFailed';
	}
}

const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** How long a project's issue types and a site's priorities are kept for outbound pushes. */
const CATALOG_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Where an import continues next time: the run's start (less a margin) when every page was read and every issue
 * applied; the change time of the first issue that failed (the pages come oldest change first: everything before it
 * is in); the change time of the last issue applied when the run stopped early (the safety cap, or an error of the
 * API); the position it started from when it applied nothing.
 */
export function resumeCursorOf(input: {
	complete: boolean;
	runCursor: string;
	since: string | null;
	firstFailedUpdated: string | null;
	lastAppliedUpdated: string | null;
}): string | null {
	if (input.firstFailedUpdated) return input.firstFailedUpdated;
	if (input.complete) return input.runCursor;
	return input.lastAppliedUpdated ?? input.since;
}

/** An instant Jira wrote (`2026-11-11T10:00:00.000+0000`) as ISO, or null. */
export function isoOf(value: string | null | undefined): string | null {
	if (!value) return null;
	const at = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
	return Number.isFinite(at) ? new Date(at).toISOString() : null;
}

/**
 * The sync itself: an import of a mapped project's issues (every one, or those changed since the position), one issue
 * from a webhook, and a task's changes sent back to its issue — its fields edited, its status moved by the transition
 * that reaches the mapped status. Inbound writes go through the platform's `IntegrationMapSyncIssueCommand` (one id map
 * per issue, a task created once and updated after) with `triggeredEvent = false`, so nothing the sync writes is sent
 * out again. Every call to Jira waits once for a rate limit, and renews the token once when Jira refused it.
 */
@Injectable()
export class JiraSyncService {
	private readonly logger = new Logger(JiraSyncService.name);
	private readonly issueTypesCache = new Map<string, { at: number; issueTypes: JiraIssueType[] }>();
	private readonly prioritiesCache = new Map<string, { at: number; priorities: JiraPriority[] }>();
	/** The pushes of each task, one after the other (a create and a quick edit never race to create two issues). */
	private readonly pushChains = new Map<string, Promise<void>>();
	/** The applies of each issue, one after the other (an import and a webhook never create two tasks for one issue). */
	private readonly issueChains = new Map<string, Promise<ApplyResult>>();
	private readonly detailsChains = new Map<string, Promise<void>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly tenants: JiraTenantService,
		private readonly mappings: JiraMappingService,
		private readonly runs: JiraSyncRunService,
		private readonly dataSource: DataSource,
		private readonly employeeService: EmployeeService,
		private readonly integrationMapService: IntegrationMapService,
		private readonly integrationTenantSyncService: IntegrationTenantSyncService,
		private readonly issueDetails: JiraIssueDetailsService,
		private readonly conflicts: JiraSyncConflictService,
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig
	) {}

	// ---------------------------------------------------------------- inbound: import

	/**
	 * Imports the mapping's issues into a claimed run, streamed a page at a time (oldest change first): every issue of
	 * the project (of the mapped issue types), or those changed since the position unless `full`; each one a task
	 * created or updated, sub-tasks linked to their parents and issue links recorded at the end. The run reports as it
	 * goes, and records where the next import continues ({@link resumeCursorOf}): a run that stopped at the safety cap,
	 * or on an error, continues from the last issue it applied; a failed issue is read again. The run row is always
	 * finished.
	 */
	async importMapping(tenant: IIntegrationTenant, mapping: JiraProjectMapping, run: JiraSyncRun, options: { full?: boolean } = {}): Promise<void> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const user = jiraSyncUser(scope, this.connectedByUserId(tenant) ?? run.requestedByUserId ?? null);
		const counts = emptyCounts();
		const since = options.full ? null : mapping.lastCursor ?? null;
		const report = emptyReport(since);
		// The next import starts a little before this run did: an issue changed while the pages were read would otherwise
		// be skipped next time. Reading a few issues again is harmless (the apply is idempotent through the id map).
		const runCursor = new Date(Date.now() - JIRA_IMPORT_CLOCK_SKEW_MS).toISOString();
		const progress = { firstFailedUpdated: null as string | null, lastAppliedUpdated: null as string | null };
		let error: string | null = null;
		let complete = false;
		let applied = false;
		/** A later claim failed this run as abandoned (no heartbeat for 30 minutes): its import stops and writes nothing more. */
		let superseded = false;
		try {
			await runInJiraContext(user, async () => {
				const context = await this.openContext(tenant, mapping, counts, run.id as ID, report);
				const jql = importJqlOf({ projectId: mapping.jiraProjectId, issueTypeIds: context.issueTypeIds, updatedSince: since });
				let nextPageToken: string | null = null;
				for (;;) {
					const page = await this.call(context, (client) => client.searchIssues(jql, { nextPageToken, maxResults: JIRA_ISSUES_PAGE_SIZE }));
					report.pages += 1;
					for (const issue of page.issues) {
						report.issuesRead += 1;
						const ok = await this.applyOne(context, issue);
						const updated = isoOf(issue.fields?.updated);
						if (!ok && !progress.firstFailedUpdated) progress.firstFailedUpdated = updated ?? since;
						if (ok && updated) progress.lastAppliedUpdated = updated;
					}
					applied = true;
					if (!(await this.runs.progress(run, counts, report))) throw new JiraRunSuperseded(run.id as ID);
					if (!page.nextPageToken || !page.issues.length) {
						complete = true;
						break;
					}
					if (report.issuesRead >= JIRA_IMPORT_MAX_ISSUES) break;
					nextPageToken = page.nextPageToken;
				}
				await this.linkParents(context);
				await this.linkRelations(context);
				// A parent or a link that could not be recorded: the next import reads its issue again (the pages come oldest
				// change first, so the position goes back to it).
				const linkFailed = context.linkFailedUpdated ?? null;
				if (linkFailed && (!progress.firstFailedUpdated || linkFailed < progress.firstFailedUpdated)) progress.firstFailedUpdated = linkFailed;
				this.reportDetails(context);
			});
			if (counts.failed > 0) {
				error = `${counts.failed} issue(s) could not be applied; the next import reads them again.`;
			} else if (!complete) {
				error = `The import stopped at ${JIRA_IMPORT_MAX_ISSUES} issues; the next import continues from the last one applied.`;
			}
		} catch (caught) {
			superseded = caught instanceof JiraRunSuperseded;
			error = this.describe(caught);
			if (caught instanceof JiraApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN] ?? null);
			}
			if (!superseded) this.logger.warn(`Import of mapping ${mapping.id} failed: ${error}`);
		} finally {
			// The mapping is another run's now (a later claim failed this one as abandoned): neither its position nor this
			// run's outcome is written, so the live run's are not overwritten.
			// Unknown (the check failed) counts as superseded: a position written over a live run's would lose its progress;
			// one not written is read again by the next import.
			if (!superseded) superseded = !(await this.runs.isLive(run).catch(() => false));
			if (superseded) {
				this.logger.warn(`Import run ${run.id} of mapping ${mapping.id} was superseded by a later claim; it stopped without writing the position.`);
			} else {
				const cursor = applied || complete ? resumeCursorOf({ complete, runCursor, since, ...progress }) : since;
				report.complete = complete && !counts.failed;
				report.stoppedAt = cursor;
				try {
					await this.mappings.recordImport(mapping, { cursor, error });
				} catch (caught) {
					error = error ?? this.describe(caught);
					this.logger.warn(`The import position of mapping ${mapping.id} could not be written: ${this.describe(caught)}`);
				}
				// Always: a run row left RUNNING would block the mapping until it counts as abandoned.
				await this.runs.finish(run, { counts, cursor, error, report }).catch((caught: unknown) => {
					this.logger.warn(`Run ${run.id} could not be finished: ${this.describe(caught)}`);
				});
			}
		}
		if (!error && !superseded) {
			await this.integrationTenantSyncService
				.recordSyncCompleted(tenant.id as ID, { tenantId: scope.tenantId, organizationId: scope.organizationId, counts: { issue: counts.created + counts.updated } })
				.catch((caught: unknown) => this.logger.warn(`The sync completion of ${tenant.id} could not be recorded: ${this.describe(caught)}`));
		}
	}

	// ---------------------------------------------------------------- inbound: webhook

	/**
	 * Applies one issue a webhook named: read again from Jira (a delivery is a snapshot; the read is the issue now), then
	 * imported through the connection's inbound mapping of its project, when the mapping takes its issue type. The import
	 * position is not touched: one issue says nothing about the others, and a delivery that was lost is read by the next
	 * import. Answers whether it was applied, or why not.
	 */
	async applyIssueFromWebhook(tenant: IIntegrationTenant, issueId: string, projectId: string | null): Promise<{ applied: boolean; error: string | null }> {
		let mapping: JiraProjectMapping | null = null;
		if (projectId) {
			mapping = await this.mappings.findInboundForProject(tenant.id as ID, projectId);
			if (!mapping) return { applied: false, error: null };
		}
		let holder: ClientHolder;
		let issue: JiraIssue | null;
		try {
			holder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
			issue = await this.call(holder, (client) => client.issue(issueId));
		} catch (caught) {
			if (caught instanceof JiraApiError && caught.isUnauthorized) await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN] ?? null);
			return { applied: false, error: this.describe(caught) };
		}
		// Gone, or out of the token's sight: nothing to apply (the task stays as it was).
		if (!issue) return { applied: false, error: null };
		const issueProjectId = issue.fields?.project?.id ? String(issue.fields.project.id) : null;
		if (!mapping || mapping.jiraProjectId !== issueProjectId) {
			mapping = issueProjectId ? await this.mappings.findInboundForProject(tenant.id as ID, issueProjectId) : null;
			if (!mapping) return { applied: false, error: null };
		}
		if (!isIssueTypeAllowed(issue, parseIssueTypeIds(mapping.issueTypeIds))) return { applied: false, error: null };
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		const run = await this.runs.startWebhookRun(tenant, mapping.id as ID);
		const counts = emptyCounts();
		const report = emptyReport(null);
		let error: string | null = null;
		const found = issue;
		const target = mapping;
		try {
			await runInJiraContext(jiraSyncUser(scope, this.connectedByUserId(tenant)), async () => {
				const context = await this.openContext(holder.tenant, target, counts, run.id as ID, report);
				context.client = holder.client;
				report.pages = 1;
				report.issuesRead = 1;
				await this.applyOne(context, found);
				await this.linkParents(context);
				await this.linkRelations(context);
				this.reportDetails(context);
			});
			// A task or a detail that could not be written is the run's failure: the delivery is released for its retry.
			if (counts.failed > 0) error = `${counts.failed} issue(s) or detail(s) could not be applied.`;
			report.complete = !error;
		} catch (caught) {
			error = this.describe(caught);
			if (caught instanceof JiraApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN] ?? null);
			}
			this.logger.warn(`Webhook issue ${issueId} of mapping ${mapping.id} failed: ${error}`);
		} finally {
			await this.runs.finish(run, { counts, cursor: mapping.lastCursor ?? null, error, report }).catch(() => undefined);
		}
		return { applied: !error && counts.skipped === 0, error };
	}

	// ---------------------------------------------------------------- outbound

	/**
	 * Sends a task's changes to its issue, or creates the issue when the project's mapping sends new tasks out. The saved
	 * task is read again by id (an event may carry only the fields that changed); the pushes of one task run one after
	 * the other. Never throws: an outbound push is best effort beside the task's own save.
	 */
	pushTask(taskId: ID, tenantId: ID): Promise<void> {
		const key = String(taskId);
		const previous = this.pushChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.pushTaskNow(taskId, tenantId))
			.catch((caught: unknown) => this.logger.warn(`Task ${taskId} could not be sent to Jira: ${this.describe(caught)}`))
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
		const tenant = await this.tenants.findAnyById(mapping.integrationId);
		// The connection must be the task's tenant's, and usable (a site chosen, no refusal waiting for a person).
		if (!tenant || String(tenant.tenantId) !== String(tenantId)) return;
		const summary = this.tenants.summaryOf(tenant);
		if (summary.siteRequired || summary.attentionReason) return;
		const holder: ClientHolder = { tenant, client: await this.tenants.clientReady(tenant), renewed: false };
		try {
			const statusMap = parseStatusMap(mapping.statusMap);
			const priorities = await this.sitePriorities(holder, mapping.integrationId);
			const fields = issueUpdateOf(task, priorities);
			const existing = await this.findIssueMap(task.id as ID, mapping.integrationId, scope);
			if (existing?.sourceId) {
				// A description the platform did not change since the issue last sent it stays Jira's (its rich text may hold
				// what the task store cannot keep, such as media): an edit of another field never rewrites it.
				const keepDescription = await this.conflicts
					.descriptionUnchangedSinceSync({ tenantId, integrationId: mapping.integrationId, sourceId: existing.sourceId, task: task as unknown as Record<string, unknown> })
					// Unknown (the read failed): kept, as an unchanged one is; a real edit goes out with the next push.
					.catch(() => true);
				const update = keepDescription ? withoutDescription(fields) : fields;
				await this.call(holder, (client) => client.updateIssue(existing.sourceId, update));
				await this.moveToStatus(holder, existing.sourceId, task.status ?? null, statusMap);
				return;
			}
			if (!fields.summary) return;
			const issueTypes = await this.projectIssueTypes(holder, mapping.integrationId, mapping.jiraProjectId);
			const issueType = chooseCreateIssueType(issueTypes, parseIssueTypeIds(mapping.issueTypeIds));
			if (!issueType) {
				this.logger.warn(`Task ${task.id}: the Jira project of mapping ${mapping.id} has no issue type a task can be created as.`);
				return;
			}
			const created = await this.createIssueOnce(holder, mapping, task.id as ID, scope, {
				...fields,
				summary: fields.summary,
				project: { id: mapping.jiraProjectId },
				issuetype: { id: issueType.id }
			});
			if (created) await this.moveToStatus(holder, created, task.status ?? null, statusMap);
		} catch (caught) {
			if (caught instanceof JiraApiError && caught.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN] ?? null);
			}
			throw caught;
		}
	}

	/** Moves an issue to where the task's status maps, by the transition that reaches it (none when it is there already). */
	private async moveToStatus(holder: ClientHolder, issueId: string, taskStatus: string | null, statusMap: JiraStatusMap): Promise<void> {
		if (!taskStatus) return;
		const issue = await this.call(holder, (client) => client.issue(issueId));
		if (!issue) return;
		const transitions = await this.call(holder, (client) => client.transitions(issueId));
		const transition = chooseTransition(transitions, issue.fields?.status, taskStatus, statusMap);
		if (!transition) return;
		await this.call(holder, (client) => client.transitionIssue(issueId, transition.id));
	}

	/**
	 * Runs `work` in a transaction that holds a cross-process lock on each key: an advisory lock on Postgres (taken in
	 * the transaction, released with its commit), a named lock on MySQL / MariaDB (a session lock: taken on the
	 * transaction's own connection before it starts and released only after it committed or rolled back, so a waiter
	 * always reads what the holder wrote); SQLite serializes writers. The statements are parameterized: a key is a bind
	 * value, never part of the SQL.
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
	 * Creates the issue of a task and records its id map; answers the issue's id, or null when another process recorded
	 * one meanwhile. The pushes of one task are already one after the other in this process (`pushChains`); the issue
	 * is created outside any transaction (no pool connection held across the call to Jira), and the map is written in a
	 * short transaction locked per task that looks again: when another process recorded a map meanwhile, the issue just
	 * created is deleted again, so the task keeps one issue.
	 */
	private async createIssueOnce(
		holder: ClientHolder,
		mapping: JiraProjectMapping,
		taskId: ID,
		scope: { tenantId: ID; organizationId: ID },
		fields: Parameters<JiraApiClient['createIssue']>[0]
	): Promise<string | null> {
		const issue = await this.call(holder, (client) => client.createIssue(fields));
		// The issue exists in Jira from here: when its id map cannot be written, it is deleted again (best effort), or the
		// next change of the task, finding no map, would create a second issue.
		const recorded = await this.lockedTransaction([`integration-jira:task:${taskId}`], async (manager) => {
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
		}).catch(async (error: unknown) => {
			await this.call(holder, (client) => client.deleteIssue(issue.id)).catch((caught: unknown) => {
				this.logger.warn(`Issue ${issue.key} of task ${taskId} has no id map and could not be deleted: ${this.describe(caught)}`);
			});
			throw error;
		});
		if (!recorded) {
			await this.call(holder, (client) => client.deleteIssue(issue.id)).catch((caught: unknown) => {
				this.logger.warn(`Issue ${issue.key} was created twice for task ${taskId} and could not be deleted: ${this.describe(caught)}`);
			});
			return null;
		}
		return issue.id;
	}

	// ---------------------------------------------------------------- one issue

	private async openContext(tenant: IIntegrationTenant, mapping: JiraProjectMapping, counts: JiraSyncCounts, runId: ID | null, report: JiraSyncRunReport): Promise<ApplyContext> {
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
			statusMap: parseStatusMap(mapping.statusMap),
			issueTypeIds: parseIssueTypeIds(mapping.issueTypeIds),
			statusIdsByName,
			priorityIdsByName,
			employeeIdsByEmail: new Map(),
			tagIdsByLabel: new Map(),
			pendingParents: [],
			pendingRelations: [],
			connectedByUserId: this.connectedByUserId(tenant),
			authorsByEmail: new Map(),
			details: { comments: 0, links: 0, failed: 0 },
			counts,
			report
		};
	}

	/**
	 * One issue of a run, then its comments and attachments: a failure counts, is named in the report and logged; a
	 * refusal of the API stops the run. Answers whether the issue went in whole: a comment or attachment that could not
	 * be read or kept answers false too, so the import position stays at the issue and the next import reads it again.
	 */
	private async applyOne(context: ApplyContext, issue: JiraIssue): Promise<boolean> {
		let taskId: ID | null;
		try {
			const result = await this.applyIssue(context, issue);
			context.counts[result.outcome] += 1;
			taskId = result.taskId;
		} catch (caught) {
			if (caught instanceof JiraApiError) throw caught;
			context.counts.failed += 1;
			this.noteFailure(context, issue.key, caught);
			this.logger.warn(`Issue ${issue.key} (${issue.id}) could not be applied: ${this.describe(caught)}`);
			return false;
		}
		// Behind the issue itself: its comments and attachments (they came with it), kept one run at a time per issue
		// under the issue's own lock: a webhook and an import that meet on one issue would otherwise both find no mapped
		// comment and keep it twice.
		const detailsFailedBefore = context.details.failed;
		if (taskId) {
			const detailsContext = this.detailsContextOf(context);
			const resolvedTaskId = taskId;
			try {
				// A search answers an issue with its first comments only: the rest are read before the details are kept.
				const whole = await this.withAllComments(context, issue);
				await this.serializedDetails(`${context.mapping.integrationId}:${issue.id}`, () => this.issueDetails.apply(detailsContext, whole, resolvedTaskId));
			} catch (caught) {
				// The API's refusal is the run's; a lock that could not be taken, or a store error, is this issue's details failing, and the run goes on.
				if (caught instanceof JiraApiError) throw caught;
				context.details.failed += 1;
				this.noteFailure(context, issue.key, caught);
				this.logger.warn(`The details of issue ${issue.key} could not be kept: ${this.describe(caught)}`);
			}
		}
		return context.details.failed === detailsFailedBefore;
	}

	/**
	 * The issue with all its comments (up to {@link JIRA_ISSUE_COMMENTS_MAX}): a search answers the first ones and their
	 * `total`; when that is more, the comments are read again from the start, page by page, oldest first.
	 */
	private async withAllComments(holder: ClientHolder, issue: JiraIssue): Promise<JiraIssue> {
		const field = issue.fields?.comment;
		const embedded = field?.comments ?? [];
		const total = typeof field?.total === 'number' ? field.total : embedded.length;
		if (total <= embedded.length) return issue;
		const comments: JiraComment[] = [];
		let known = total;
		while (comments.length < Math.min(known, JIRA_ISSUE_COMMENTS_MAX)) {
			const page = await this.call(holder, (client) => client.issueComments(issue.id, comments.length, JIRA_COMMENTS_PAGE_SIZE));
			if (!page.comments.length) break;
			comments.push(...page.comments);
			known = page.total;
		}
		return { ...issue, fields: { ...issue.fields, comment: { comments: comments.slice(0, JIRA_ISSUE_COMMENTS_MAX), total: known } } };
	}

	private noteFailure(context: ApplyContext, key: string, error: unknown): void {
		if (context.report.failures.length < JIRA_REPORT_MAX_FAILURES) context.report.failures.push({ key, error: this.describe(error) });
		else context.report.moreFailures += 1;
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
	 * One line per run about the details, when there were any; what could not be read or kept counts as a failure of the
	 * run, so the next import reads the issue again. The report carries the same.
	 */
	private reportDetails(context: ApplyContext): void {
		context.report.conflicts += context.conflicts;
		if (context.conflicts) {
			this.logger.log(`Mapping ${context.mapping.id}: ${context.conflicts} field(s) changed on both sides; Jira's value applied, the task's recorded as a conflict`);
			context.conflicts = 0;
		}
		const { comments, links, failed } = context.details;
		context.report.comments += comments;
		context.report.links += links;
		if (failed) {
			context.counts.failed += failed;
		}
		if (comments || links || failed) {
			this.logger.log(`Mapping ${context.mapping.id}: ${comments} comment(s) and ${links} attachment link(s) brought in, ${failed} not read or kept`);
		}
		// Counted once: a second report on the same context would count them again.
		context.details.comments = 0;
		context.details.links = 0;
		context.details.failed = 0;
	}

	/** The details of one issue, one run at a time: chained in the process, locked across processes. */
	private serializedDetails(key: string, work: () => Promise<void>): Promise<void> {
		const previous = this.detailsChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.lockedTransaction([`integration-jira:issue-details:${key}`], () => work()))
			.finally(() => {
				if (this.detailsChains.get(key) === next) this.detailsChains.delete(key);
			});
		this.detailsChains.set(key, next);
		return next;
	}

	/**
	 * One issue → one task, one apply at a time per issue: in this process the applies of an issue are chained, and
	 * across processes they wait for a lock on the issue held while the platform's id-map command runs (an import and a
	 * webhook, or two deliveries, never create two tasks for one issue).
	 */
	private applyIssue(context: ApplyContext, issue: JiraIssue): Promise<ApplyResult> {
		const key = `${context.mapping.integrationId}:${issue.id}`;
		const previous = this.issueChains.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.lockedTransaction([`integration-jira:issue:${key}`], () => this.applyIssueNow(context, issue)))
			.finally(() => {
				if (this.issueChains.get(key) === next) this.issueChains.delete(key);
			});
		this.issueChains.set(key, next);
		return next;
	}

	/**
	 * One issue → one task: created once, updated after, by the platform's id map. A relation whose lookup did not
	 * answer (the employee by e-mail, a label's tag) is left as the task has it; an empty value from Jira clears it. The
	 * synced fields of a mapped task are merged three ways with what the issue and the task last agreed on: a field
	 * changed only on the platform keeps the task's value, one changed on both sides takes Jira's and records the task's
	 * as a conflict. An issue of a type the mapping does not take is skipped.
	 */
	private async applyIssueNow(context: ApplyContext, issue: JiraIssue): Promise<ApplyResult> {
		const { scope, mapping } = context;
		const integrationId = mapping.integrationId;
		if (!isIssueTypeAllowed(issue, context.issueTypeIds)) return { outcome: 'skipped', taskId: null };
		const existing = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, sourceId: issue.id, integrationId, ...scope })
			.catch(() => null);
		const fields = taskFieldsOf(issue, context.statusMap);
		const external = syncedValuesOf(fields);
		const merge = await this.conflicts.prepare({ ...scope, integrationId, sourceId: issue.id, taskId: (existing?.gauzyId as ID | undefined) ?? null, external });
		const members = await this.membersOf(context, issue.fields?.assignee ?? null);
		const tags = await this.tagsOf(context, issue.fields?.labels ?? []);
		const entity = {
			...scope,
			projectId: mapping.projectId,
			title: fields.title,
			// Null when Jira cleared it: the task's old description goes too.
			description: fields.description,
			status: fields.status,
			taskStatusId: context.statusIdsByName.get(fields.status.toLowerCase()) ?? null,
			priority: fields.priority ?? null,
			taskPriorityId: fields.priority ? context.priorityIdsByName.get(fields.priority.toLowerCase()) ?? null : null,
			dueDate: fields.dueDate,
			...(members === undefined ? {} : { members }),
			...(tags === undefined ? {} : { tags }),
			// A sub-task is linked once its parent is in (below); an issue without a parent leaves its former one.
			...(issue.fields?.parent?.id ? {} : { parentId: null })
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
				.catch((error: unknown) => this.logger.warn(`The conflicts recorded for issue ${issue.key} could not be taken back: ${this.describe(error)}`));
			throw caught;
		}
		if (issue.fields?.parent?.id && map?.gauzyId) {
			context.pendingParents.push({ taskId: map.gauzyId as ID, parentSourceId: String(issue.fields.parent.id), updated: isoOf(issue.fields?.updated) });
		}
		for (const link of issue.fields?.issuelinks ?? []) {
			const ends = linkEndsOf(issue.id, link);
			if (ends) context.pendingRelations.push({ ...ends, updated: isoOf(issue.fields?.updated) });
		}
		if (map?.gauzyId) {
			// The issue's values become what both sides agreed on; a failure here fails the issue (its conflicts stay recorded) and the next import writes it again.
			await this.conflicts.settle({ ...scope, integrationId, sourceId: issue.id, taskId: map.gauzyId as ID, external, recorded });
			context.conflicts += recorded.length;
		}
		return { outcome: existing ? 'updated' : 'created', taskId: (map?.gauzyId as ID | undefined) ?? null };
	}

	/** Sub-tasks point at their parent's task once every issue of the run is in (a parent may come later in the pages). */
	private async linkParents(context: ApplyContext): Promise<void> {
		for (const pending of context.pendingParents.splice(0)) {
			const parent = await this.mapOf(context, pending.parentSourceId);
			if (!parent || parent === pending.taskId) continue;
			await this.commandBus
				.execute(new TaskUpdateCommand(pending.taskId, { ...context.scope, parentId: parent } as ITaskUpdateInput, false))
				.catch((caught: unknown) => {
					this.logger.warn(`Task ${pending.taskId} could not be linked to its parent: ${this.describe(caught)}`);
					this.noteLinkFailure(context, pending.updated ?? null);
				});
		}
	}

	/** A parent or a link that could not be recorded: a failure of the run, and the import position stays at its issue. */
	private noteLinkFailure(context: ApplyContext, updated: string | null): void {
		context.details.failed += 1;
		if (updated && (!context.linkFailedUpdated || updated < context.linkFailedUpdated)) context.linkFailedUpdated = updated;
	}

	/**
	 * The issue links whose two ends are tasks become the platform's linked issues (blocks, clones, duplicates, relates
	 * to), each once: a link is read from both of its issues, and recorded from the issue it points out of. A link whose
	 * other end is not a task here (another project, not imported yet) waits for the import that brings it in.
	 */
	private async linkRelations(context: ApplyContext): Promise<void> {
		const seen = new Set<string>();
		const repository = this.dataSource.getRepository(TaskLinkedIssue);
		for (const pending of context.pendingRelations.splice(0)) {
			const key = `${pending.fromSourceId}>${pending.toSourceId}:${pending.action}`;
			if (seen.has(key)) continue;
			seen.add(key);
			try {
				const [taskFromId, taskToId] = await Promise.all([this.mapOf(context, pending.fromSourceId), this.mapOf(context, pending.toSourceId)]);
				if (!taskFromId || !taskToId || taskFromId === taskToId) continue;
				const existing = await repository.findOne({
					where: { taskFromId, taskToId, action: pending.action, tenantId: context.scope.tenantId, organizationId: context.scope.organizationId } as never,
					select: { id: true } as never
				});
				if (existing) continue;
				await repository.save(repository.create({ taskFromId, taskToId, action: pending.action, ...context.scope } as never));
				context.report.relations += 1;
			} catch (caught) {
				this.logger.warn(`The link ${key} could not be recorded: ${this.describe(caught)}`);
				this.noteLinkFailure(context, pending.updated ?? null);
			}
		}
	}

	/**
	 * The task's members for the issue's assignee: the employee with that e-mail, nobody when the issue has no assignee
	 * or no employee has the e-mail, and `undefined` (the relation left alone) when the lookup failed or Jira hides the
	 * assignee's e-mail (the person's privacy settings): an assignee nobody can match is not read as "unassigned".
	 */
	private async membersOf(context: ApplyContext, assignee: { emailAddress?: string | null } | null): Promise<Array<{ id: ID }> | undefined> {
		if (!assignee) return [];
		const email = assignee.emailAddress?.trim() ?? '';
		const key = email.toLowerCase();
		if (!key) return undefined;
		try {
			if (!context.employeeIdsByEmail.has(key)) {
				const { items } = await this.employeeService.findAll({
					where: { ...context.scope, isActive: true, isArchived: false, user: { email: In([key, email]) } },
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
	 * The task's tags for the issue's labels: one per label (a Jira label is a name), created once by the platform's label
	 * sync; `undefined` (the relation left alone) when any label's sync failed, so a passing failure never strips the
	 * task's tags.
	 */
	private async tagsOf(context: ApplyContext, labels: readonly string[]): Promise<Array<{ id: ID }> | undefined> {
		const ids: ID[] = [];
		for (const raw of labels) {
			const label = typeof raw === 'string' ? raw.trim() : '';
			if (!label) continue;
			if (!context.tagIdsByLabel.has(label)) {
				try {
					// The label sync answers the tag itself (created once, updated after), not its id map.
					const tag: ITag = await this.commandBus.execute(
						new IntegrationMapSyncLabelCommand({
							entity: { name: label.slice(0, 255), color: '#0052CC', ...context.scope } as never,
							sourceId: `label:${label}`.slice(0, 255),
							integrationId: context.mapping.integrationId,
							...context.scope
						})
					);
					context.tagIdsByLabel.set(label, (tag?.id as ID | undefined) ?? null);
				} catch (caught) {
					this.logger.warn(`Label ${label} could not be synced: ${new ResolutionFailed('label', caught).message}`);
					return undefined;
				}
			}
			const id = context.tagIdsByLabel.get(label);
			if (id) ids.push(id);
		}
		return ids.map((id) => ({ id }));
	}

	// ---------------------------------------------------------------- helpers

	/** The task an issue is, by the id map of the run's connection, or null. */
	private async mapOf(context: ApplyContext, sourceId: string): Promise<ID | null> {
		const map = await this.integrationMapService
			.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, sourceId, integrationId: context.mapping.integrationId, ...context.scope })
			.catch(() => null);
		return (map?.gauzyId as ID | undefined) ?? null;
	}

	private async findIssueMap(taskId: ID, integrationId: ID, scope: { tenantId: ID; organizationId: ID }): Promise<IIntegrationMap | null> {
		return this.integrationMapService.findOneByWhereOptions({ entity: IntegrationEntity.ISSUE, gauzyId: taskId, integrationId, ...scope }).catch(() => null);
	}

	private async projectIssueTypes(holder: ClientHolder, integrationId: ID, jiraProjectId: string): Promise<JiraIssueType[]> {
		const key = `${integrationId}:${jiraProjectId}`;
		const cached = this.issueTypesCache.get(key);
		if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.issueTypes;
		const project = await this.call(holder, (client) => client.project(jiraProjectId));
		const issueTypes = project?.issueTypes ?? [];
		this.issueTypesCache.set(key, { at: Date.now(), issueTypes });
		return issueTypes;
	}

	private async sitePriorities(holder: ClientHolder, integrationId: ID): Promise<JiraPriority[]> {
		const key = String(integrationId);
		const cached = this.prioritiesCache.get(key);
		if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.priorities;
		// A site whose priorities cannot be read leaves the issues' priorities alone.
		const priorities = await this.call(holder, (client) => client.priorities()).catch((caught: unknown) => {
			if (caught instanceof JiraApiError && caught.isUnauthorized) throw caught;
			return [] as JiraPriority[];
		});
		this.prioritiesCache.set(key, { at: Date.now(), priorities });
		return priorities;
	}

	/**
	 * One call to Jira with the connection's client: a rate limit is waited out once (what Jira asked, up to a minute)
	 * and the call made again; a refused token is renewed once with the refresh token and the call made again with the
	 * new client. Anything else is the caller's.
	 */
	private async call<T>(holder: ClientHolder, make: (client: JiraApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(holder.client);
		} catch (caught) {
			if (caught instanceof JiraApiError && caught.isRateLimited) {
				await sleep(Math.min(Math.max((caught.retryAfterSeconds ?? 5) * 1000, 1000), RATE_LIMIT_MAX_WAIT_MS));
				return make(holder.client);
			}
			if (caught instanceof JiraApiError && caught.isUnauthorized && !holder.renewed) {
				holder.renewed = true;
				const renewed = await this.tenants.refreshAccessToken(holder.tenant, holder.client);
				if (renewed) {
					holder.client = renewed;
					return make(holder.client);
				}
			}
			throw caught;
		}
	}

	private connectedByUserId(tenant: IIntegrationTenant): ID | null {
		const value = this.tenants.settingsOf(tenant)[JiraSettingName.CONNECTED_BY_USER_ID];
		return value ? (value as ID) : null;
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
