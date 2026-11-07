import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { AsanaSyncRun, AsanaSyncRunKind, AsanaSyncRunStatus, MikroOrmAsanaSyncRunRepository, TypeOrmAsanaSyncRunRepository } from './entities/asana-sync-run.entity';
import { AsanaProjectMapping } from './entities/asana-project-mapping.entity';
import { ASANA_RUN_IN_PROGRESS } from './asana.constants';

export interface AsanaSyncCounts {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
}

export function emptyCounts(): AsanaSyncCounts {
	return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

/** A running import that made no progress for this long is abandoned (its process died): it no longer blocks a new one. */
export const ASANA_IMPORT_STALE_MS = 30 * 60 * 1000;
/** Webhook runs (one per delivery) are kept this long; imports are kept. */
export const ASANA_WEBHOOK_RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The runs (imports, webhook applications) of the connections: claimed, started, advanced, finished, listed. */
@Injectable()
export class AsanaSyncRunService extends TenantAwareCrudService<AsanaSyncRun> {
	constructor(
		readonly typeOrmAsanaSyncRunRepository: TypeOrmAsanaSyncRunRepository,
		readonly mikroOrmAsanaSyncRunRepository: MikroOrmAsanaSyncRunRepository,
		private readonly dataSource: DataSource
	) {
		super(typeOrmAsanaSyncRunRepository, mikroOrmAsanaSyncRunRepository);
	}

	/** The latest runs of a connection, newest first. */
	async list(tenant: IIntegrationTenant, take = 50): Promise<AsanaSyncRun[]> {
		return this.typeOrmAsanaSyncRunRepository.find({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID },
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(take, 1), 200)
		});
	}

	/** Whether an import of the mapping is live now (running, with progress within the stale window). */
	async hasRunning(mappingId: ID): Promise<boolean> {
		const count = await this.typeOrmAsanaSyncRunRepository.count({
			where: { mappingId, kind: AsanaSyncRunKind.IMPORT, status: AsanaSyncRunStatus.RUNNING, updatedAt: MoreThanOrEqual(new Date(Date.now() - ASANA_IMPORT_STALE_MS)) }
		});
		return count > 0;
	}

	/**
	 * Claims the mapping for one import: in one transaction (serialised per mapping on Postgres with an advisory
	 * lock), abandoned runs are failed, a live one refuses the claim (409), and the new run is written.
	 */
	async claimImport(tenant: IIntegrationTenant, mapping: AsanaProjectMapping, input: { full?: boolean; requestedByUserId?: ID | null }): Promise<AsanaSyncRun> {
		return this.dataSource.transaction(async (manager) => {
			// Every writer of the mapping's runs is serialized: an advisory lock on Postgres (a parameterized
			// statement, the key a bind value), the mapping's row locked on MySQL / MariaDB; SQLite serializes writers.
			const dialect = manager.connection.options.type;
			if (dialect === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-asana:import:${mapping.id}`]);
			} else if (dialect === 'mysql' || dialect === 'mariadb') {
				await manager.findOne(AsanaProjectMapping, { where: { id: mapping.id } as never, lock: { mode: 'pessimistic_write' } });
			}
			const staleBefore = new Date(Date.now() - ASANA_IMPORT_STALE_MS);
			await manager.update(
				AsanaSyncRun,
				{ mappingId: mapping.id, kind: AsanaSyncRunKind.IMPORT, status: AsanaSyncRunStatus.RUNNING, updatedAt: LessThan(staleBefore) },
				{ status: AsanaSyncRunStatus.FAILED, finishedAt: new Date(), lastError: 'Abandoned: no progress for 30 minutes (the process stopped).', updatedAt: new Date() } as never
			);
			const live = await manager.count(AsanaSyncRun, { where: { mappingId: mapping.id, kind: AsanaSyncRunKind.IMPORT, status: AsanaSyncRunStatus.RUNNING } });
			if (live > 0) {
				throw new ConflictException({ message: 'An import of this mapping is running', code: ASANA_RUN_IN_PROGRESS });
			}
			const run = Object.assign(new AsanaSyncRun(), {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				organizationId: tenant.organizationId as ID,
				mappingId: mapping.id,
				kind: AsanaSyncRunKind.IMPORT,
				status: AsanaSyncRunStatus.RUNNING,
				full: !!input.full,
				requestedByUserId: input.requestedByUserId ?? null,
				startedAt: new Date()
			});
			return manager.save(AsanaSyncRun, run);
		});
	}

	/** A webhook application: one delivery, no claim needed. */
	async startWebhookRun(tenant: IIntegrationTenant, mappingId: ID): Promise<AsanaSyncRun> {
		const run = Object.assign(new AsanaSyncRun(), {
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			mappingId,
			kind: AsanaSyncRunKind.WEBHOOK,
			status: AsanaSyncRunStatus.RUNNING,
			full: false,
			requestedByUserId: null,
			startedAt: new Date()
		});
		return this.typeOrmAsanaSyncRunRepository.save(run);
	}

	async finish(run: AsanaSyncRun, outcome: { counts: AsanaSyncCounts; cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmAsanaSyncRunRepository.update(
			{ id: run.id },
			{
				status: outcome.error ? AsanaSyncRunStatus.FAILED : AsanaSyncRunStatus.DONE,
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
		if (run.kind === AsanaSyncRunKind.WEBHOOK) {
			// One row per delivery on a busy project: the old ones go (the imports stay).
			await this.typeOrmAsanaSyncRunRepository
				.delete({ integrationId: run.integrationId, kind: AsanaSyncRunKind.WEBHOOK, createdAt: LessThan(new Date(Date.now() - ASANA_WEBHOOK_RUN_RETENTION_MS)) })
				.catch(() => undefined);
		}
	}

	/** Counts of a run in progress: the heartbeat that keeps it live. */
	async progress(run: AsanaSyncRun, counts: AsanaSyncCounts): Promise<void> {
		await this.typeOrmAsanaSyncRunRepository
			.update({ id: run.id }, { createdCount: counts.created, updatedCount: counts.updated, skippedCount: counts.skipped, failedCount: counts.failed, updatedAt: new Date() } as never)
			.catch(() => undefined);
	}
}
