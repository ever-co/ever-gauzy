import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import {
	JiraSyncRun,
	JiraSyncRunKind,
	JiraSyncRunStatus,
	MikroOrmJiraSyncRunRepository,
	TypeOrmJiraSyncRunRepository
} from './entities/jira-sync-run.entity';
import { JiraProjectMapping } from './entities/jira-project-mapping.entity';
import { JIRA_RUN_IN_PROGRESS } from './jira.constants';

export interface JiraSyncCounts {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
}

export function emptyCounts(): JiraSyncCounts {
	return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

/** An issue a run could not apply, by its key, and why. */
export interface JiraRunFailure {
	key: string;
	error: string;
}

/**
 * What a run reports beside its counts (stored as JSON on the run, written as it goes): where it started (the position
 * it read from, none for every issue) and where it stopped (the position the next import starts from), how much it
 * read, what it brought in beside the tasks, and the issues it could not apply.
 */
export interface JiraSyncRunReport {
	startedFrom: string | null;
	stoppedAt: string | null;
	/** Whether every page was read (a run stopped at the safety cap continues from `stoppedAt` next time). */
	complete: boolean;
	pages: number;
	issuesRead: number;
	comments: number;
	links: number;
	relations: number;
	conflicts: number;
	failures: JiraRunFailure[];
	/** How many failed issues are not named (the report names the first ones). */
	moreFailures: number;
}

export function emptyReport(startedFrom: string | null = null): JiraSyncRunReport {
	return { startedFrom, stoppedAt: null, complete: false, pages: 0, issuesRead: 0, comments: 0, links: 0, relations: 0, conflicts: 0, failures: [], moreFailures: 0 };
}

/** A stored report, or null when there is none or it cannot be read. */
export function parseRunReport(json: string | null | undefined): JiraSyncRunReport | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? ({ ...emptyReport(), ...parsed } as JiraSyncRunReport) : null;
	} catch {
		return null;
	}
}

/** A report as stored: bounded (the failures it names, the length of each reason). */
export function serializeRunReport(report: JiraSyncRunReport): string {
	return JSON.stringify({ ...report, failures: report.failures.map((failure) => ({ key: failure.key.slice(0, 64), error: failure.error.slice(0, 300) })) });
}

/** A running import that made no progress for this long is abandoned (its process died): it no longer blocks a new one. */
export const JIRA_IMPORT_STALE_MS = 30 * 60 * 1000;
/** Webhook runs (one per delivery) are kept this long; imports are kept. */
export const JIRA_WEBHOOK_RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The runs (imports, webhook applications) of the connections: claimed, started, advanced, finished, listed. */
@Injectable()
export class JiraSyncRunService extends TenantAwareCrudService<JiraSyncRun> {
	constructor(
		readonly typeOrmJiraSyncRunRepository: TypeOrmJiraSyncRunRepository,
		readonly mikroOrmJiraSyncRunRepository: MikroOrmJiraSyncRunRepository,
		private readonly dataSource: DataSource
	) {
		super(typeOrmJiraSyncRunRepository, mikroOrmJiraSyncRunRepository);
	}

	/** The latest runs of a connection, newest first. */
	async list(tenant: IIntegrationTenant, take = 50): Promise<JiraSyncRun[]> {
		return this.typeOrmJiraSyncRunRepository.find({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID },
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(take, 1), 200)
		});
	}

	/** Whether an import of the mapping is live now (running, with progress within the stale window). */
	async hasRunning(mappingId: ID): Promise<boolean> {
		const count = await this.typeOrmJiraSyncRunRepository.count({
			where: {
				mappingId,
				kind: JiraSyncRunKind.IMPORT,
				status: JiraSyncRunStatus.RUNNING,
				updatedAt: MoreThanOrEqual(new Date(Date.now() - JIRA_IMPORT_STALE_MS))
			}
		});
		return count > 0;
	}

	/**
	 * Claims the mapping for one import: in one transaction (serialised per mapping on Postgres with an advisory
	 * lock), abandoned runs are failed, a live one refuses the claim (409), and the new run is written. Two requests
	 * cannot both claim the same mapping.
	 */
	async claimImport(
		tenant: IIntegrationTenant,
		mapping: JiraProjectMapping,
		input: { full?: boolean; requestedByUserId?: ID | null }
	): Promise<JiraSyncRun> {
		return this.dataSource.transaction(async (manager) => {
			if (manager.connection.options.type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-jira:import:${mapping.id}`]);
			}
			const staleBefore = new Date(Date.now() - JIRA_IMPORT_STALE_MS);
			await manager.update(
				JiraSyncRun,
				{ mappingId: mapping.id, kind: JiraSyncRunKind.IMPORT, status: JiraSyncRunStatus.RUNNING, updatedAt: LessThan(staleBefore) },
				{ status: JiraSyncRunStatus.FAILED, finishedAt: new Date(), lastError: 'Abandoned: no progress for 30 minutes (the process stopped).', updatedAt: new Date() } as never
			);
			const live = await manager.count(JiraSyncRun, {
				where: { mappingId: mapping.id, kind: JiraSyncRunKind.IMPORT, status: JiraSyncRunStatus.RUNNING }
			});
			if (live > 0) {
				throw new ConflictException({ message: 'An import of this mapping is running', code: JIRA_RUN_IN_PROGRESS });
			}
			const run = Object.assign(new JiraSyncRun(), {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				organizationId: tenant.organizationId as ID,
				mappingId: mapping.id,
				kind: JiraSyncRunKind.IMPORT,
				status: JiraSyncRunStatus.RUNNING,
				full: !!input.full,
				requestedByUserId: input.requestedByUserId ?? null,
				startedAt: new Date()
			});
			return manager.save(JiraSyncRun, run);
		});
	}

	/** A webhook application: one issue, no claim needed. */
	async startWebhookRun(tenant: IIntegrationTenant, mappingId: ID): Promise<JiraSyncRun> {
		const run = Object.assign(new JiraSyncRun(), {
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			mappingId,
			kind: JiraSyncRunKind.WEBHOOK,
			status: JiraSyncRunStatus.RUNNING,
			full: false,
			requestedByUserId: null,
			startedAt: new Date()
		});
		return this.typeOrmJiraSyncRunRepository.save(run);
	}

	/** Finishes a running run (a run a later claim failed as abandoned keeps that outcome). */
	async finish(run: JiraSyncRun, outcome: { counts: JiraSyncCounts; cursor?: string | null; error?: string | null; report?: JiraSyncRunReport | null }): Promise<void> {
		await this.typeOrmJiraSyncRunRepository.update(
			{ id: run.id, status: JiraSyncRunStatus.RUNNING } as never,
			{
				status: outcome.error ? JiraSyncRunStatus.FAILED : JiraSyncRunStatus.DONE,
				finishedAt: new Date(),
				updatedAt: new Date(),
				createdCount: outcome.counts.created,
				updatedCount: outcome.counts.updated,
				skippedCount: outcome.counts.skipped,
				failedCount: outcome.counts.failed,
				cursor: outcome.cursor ?? null,
				...(outcome.report ? { report: serializeRunReport(outcome.report) } : {}),
				lastError: outcome.error ? outcome.error.slice(0, 2000) : null
			} as never
		);
		if (run.kind === JiraSyncRunKind.WEBHOOK) {
			// One row per delivery on a busy workspace: the old ones go (the imports stay).
			await this.typeOrmJiraSyncRunRepository
				.delete({ integrationId: run.integrationId, kind: JiraSyncRunKind.WEBHOOK, createdAt: LessThan(new Date(Date.now() - JIRA_WEBHOOK_RUN_RETENTION_MS)) })
				.catch(() => undefined);
		}
	}

	/**
	 * Counts of a run in progress: the heartbeat that keeps it live (a long import shows its progress). Answers whether
	 * the run still holds its mapping: false once a later claim failed it as abandoned (no heartbeat for 30 minutes), and
	 * its import must then stop, without writing the mapping's position. A heartbeat that could not be written keeps it.
	 */
	async progress(run: JiraSyncRun, counts: JiraSyncCounts, report?: JiraSyncRunReport | null): Promise<boolean> {
		return this.typeOrmJiraSyncRunRepository
			.update(
				{ id: run.id, status: JiraSyncRunStatus.RUNNING } as never,
				{
					createdCount: counts.created,
					updatedCount: counts.updated,
					skippedCount: counts.skipped,
					failedCount: counts.failed,
					...(report ? { report: serializeRunReport(report) } : {}),
					updatedAt: new Date()
				} as never
			)
			.then((result) => result.affected === undefined || result.affected === null || result.affected > 0)
			// A heartbeat that could not be written: the run goes on only when it is known to hold its mapping still.
			.catch(() => this.isLive(run).catch(() => false));
	}

	/** Whether a run still holds its mapping (it is running: no later claim failed it as abandoned). */
	async isLive(run: JiraSyncRun): Promise<boolean> {
		const count = await this.typeOrmJiraSyncRunRepository.count({ where: { id: run.id, status: JiraSyncRunStatus.RUNNING } as never });
		return count > 0;
	}
}
