import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import {
	LinearSyncRun,
	LinearSyncRunKind,
	LinearSyncRunStatus,
	MikroOrmLinearSyncRunRepository,
	TypeOrmLinearSyncRunRepository
} from './entities/linear-sync-run.entity';
import { LinearTeamMapping } from './entities/linear-team-mapping.entity';
import { LINEAR_RUN_IN_PROGRESS } from './linear.constants';

export interface LinearSyncCounts {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
}

export function emptyCounts(): LinearSyncCounts {
	return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

/** A running import that made no progress for this long is abandoned (its process died): it no longer blocks a new one. */
export const LINEAR_IMPORT_STALE_MS = 30 * 60 * 1000;
/** Webhook runs (one per delivery) are kept this long; imports are kept. */
export const LINEAR_WEBHOOK_RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The runs (imports, webhook applications) of the connections: claimed, started, advanced, finished, listed. */
@Injectable()
export class LinearSyncRunService extends TenantAwareCrudService<LinearSyncRun> {
	constructor(
		readonly typeOrmLinearSyncRunRepository: TypeOrmLinearSyncRunRepository,
		readonly mikroOrmLinearSyncRunRepository: MikroOrmLinearSyncRunRepository,
		private readonly dataSource: DataSource
	) {
		super(typeOrmLinearSyncRunRepository, mikroOrmLinearSyncRunRepository);
	}

	/** The latest runs of a connection, newest first. */
	async list(tenant: IIntegrationTenant, take = 50): Promise<LinearSyncRun[]> {
		return this.typeOrmLinearSyncRunRepository.find({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID },
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(take, 1), 200)
		});
	}

	/** Whether an import of the mapping is live now (running, with progress within the stale window). */
	async hasRunning(mappingId: ID): Promise<boolean> {
		const count = await this.typeOrmLinearSyncRunRepository.count({
			where: {
				mappingId,
				kind: LinearSyncRunKind.IMPORT,
				status: LinearSyncRunStatus.RUNNING,
				updatedAt: MoreThanOrEqual(new Date(Date.now() - LINEAR_IMPORT_STALE_MS))
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
		mapping: LinearTeamMapping,
		input: { full?: boolean; requestedByUserId?: ID | null }
	): Promise<LinearSyncRun> {
		return this.dataSource.transaction(async (manager) => {
			if (manager.connection.options.type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-linear:import:${mapping.id}`]);
			}
			const staleBefore = new Date(Date.now() - LINEAR_IMPORT_STALE_MS);
			await manager.update(
				LinearSyncRun,
				{ mappingId: mapping.id, kind: LinearSyncRunKind.IMPORT, status: LinearSyncRunStatus.RUNNING, updatedAt: LessThan(staleBefore) },
				{ status: LinearSyncRunStatus.FAILED, finishedAt: new Date(), lastError: 'Abandoned: no progress for 30 minutes (the process stopped).', updatedAt: new Date() } as never
			);
			const live = await manager.count(LinearSyncRun, {
				where: { mappingId: mapping.id, kind: LinearSyncRunKind.IMPORT, status: LinearSyncRunStatus.RUNNING }
			});
			if (live > 0) {
				throw new ConflictException({ message: 'An import of this mapping is running', code: LINEAR_RUN_IN_PROGRESS });
			}
			const run = Object.assign(new LinearSyncRun(), {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				organizationId: tenant.organizationId as ID,
				mappingId: mapping.id,
				kind: LinearSyncRunKind.IMPORT,
				status: LinearSyncRunStatus.RUNNING,
				full: !!input.full,
				requestedByUserId: input.requestedByUserId ?? null,
				startedAt: new Date()
			});
			return manager.save(LinearSyncRun, run);
		});
	}

	/** A webhook application: one issue, no claim needed. */
	async startWebhookRun(tenant: IIntegrationTenant, mappingId: ID): Promise<LinearSyncRun> {
		const run = Object.assign(new LinearSyncRun(), {
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			mappingId,
			kind: LinearSyncRunKind.WEBHOOK,
			status: LinearSyncRunStatus.RUNNING,
			full: false,
			requestedByUserId: null,
			startedAt: new Date()
		});
		return this.typeOrmLinearSyncRunRepository.save(run);
	}

	async finish(run: LinearSyncRun, outcome: { counts: LinearSyncCounts; cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmLinearSyncRunRepository.update(
			{ id: run.id },
			{
				status: outcome.error ? LinearSyncRunStatus.FAILED : LinearSyncRunStatus.DONE,
				finishedAt: new Date(),
				updatedAt: new Date(),
				createdCount: outcome.counts.created,
				updatedCount: outcome.counts.updated,
				skippedCount: outcome.counts.skipped,
				failedCount: outcome.counts.failed,
				cursor: outcome.cursor ?? null,
				lastError: outcome.error ? outcome.error.slice(0, 2000) : null
			} as never
		);
		if (run.kind === LinearSyncRunKind.WEBHOOK) {
			// One row per delivery on a busy workspace: the old ones go (the imports stay).
			await this.typeOrmLinearSyncRunRepository
				.delete({ integrationId: run.integrationId, kind: LinearSyncRunKind.WEBHOOK, createdAt: LessThan(new Date(Date.now() - LINEAR_WEBHOOK_RUN_RETENTION_MS)) })
				.catch(() => undefined);
		}
	}

	/** Counts of a run in progress: the heartbeat that keeps it live (a long import shows its progress). */
	async progress(run: LinearSyncRun, counts: LinearSyncCounts): Promise<void> {
		await this.typeOrmLinearSyncRunRepository
			.update(
				{ id: run.id },
				{ createdCount: counts.created, updatedCount: counts.updated, skippedCount: counts.skipped, failedCount: counts.failed, updatedAt: new Date() } as never
			)
			.catch(() => undefined);
	}
}
