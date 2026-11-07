import { Injectable } from '@nestjs/common';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import {
	LinearSyncRun,
	LinearSyncRunKind,
	LinearSyncRunStatus,
	MikroOrmLinearSyncRunRepository,
	TypeOrmLinearSyncRunRepository
} from './entities/linear-sync-run.entity';

export interface LinearSyncCounts {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
}

export function emptyCounts(): LinearSyncCounts {
	return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

/** The runs (imports, webhook applications) of the connections: started, finished, listed. */
@Injectable()
export class LinearSyncRunService extends TenantAwareCrudService<LinearSyncRun> {
	constructor(
		readonly typeOrmLinearSyncRunRepository: TypeOrmLinearSyncRunRepository,
		readonly mikroOrmLinearSyncRunRepository: MikroOrmLinearSyncRunRepository
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

	/** Whether an import of the mapping is running now. */
	async hasRunning(mappingId: ID): Promise<boolean> {
		const count = await this.typeOrmLinearSyncRunRepository.count({
			where: { mappingId, kind: LinearSyncRunKind.IMPORT, status: LinearSyncRunStatus.RUNNING }
		});
		return count > 0;
	}

	async start(
		tenant: IIntegrationTenant,
		input: { mappingId: ID | null; kind: LinearSyncRunKind; full?: boolean; requestedByUserId?: ID | null }
	): Promise<LinearSyncRun> {
		const run = Object.assign(new LinearSyncRun(), {
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			mappingId: input.mappingId,
			kind: input.kind,
			status: LinearSyncRunStatus.RUNNING,
			full: input.full ?? false,
			requestedByUserId: input.requestedByUserId ?? null,
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
				createdCount: outcome.counts.created,
				updatedCount: outcome.counts.updated,
				skippedCount: outcome.counts.skipped,
				failedCount: outcome.counts.failed,
				cursor: outcome.cursor ?? null,
				lastError: outcome.error ? outcome.error.slice(0, 2000) : null
			} as never
		);
	}

	/** Counts of a run in progress (so a long import shows its progress). */
	async progress(run: LinearSyncRun, counts: LinearSyncCounts): Promise<void> {
		await this.typeOrmLinearSyncRunRepository
			.update({ id: run.id }, { createdCount: counts.created, updatedCount: counts.updated, skippedCount: counts.skipped, failedCount: counts.failed } as never)
			.catch(() => undefined);
	}
}
