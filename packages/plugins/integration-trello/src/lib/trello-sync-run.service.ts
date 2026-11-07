import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { TrelloSyncRun, TrelloSyncRunKind, TrelloSyncRunStatus, MikroOrmTrelloSyncRunRepository, TypeOrmTrelloSyncRunRepository } from './entities/trello-sync-run.entity';
import { TrelloBoardMapping } from './entities/trello-board-mapping.entity';
import { TRELLO_RUN_IN_PROGRESS } from './trello.constants';

export interface TrelloSyncCounts {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
}

export function emptyCounts(): TrelloSyncCounts {
	return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

/** A running import that made no progress for this long is abandoned (its process died): it no longer blocks a new one. */
export const TRELLO_IMPORT_STALE_MS = 30 * 60 * 1000;
/** Webhook runs (one per delivery) are kept this long; imports are kept. */
export const TRELLO_WEBHOOK_RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The runs (imports, webhook applications) of the connections: claimed, started, advanced, finished, listed. */
@Injectable()
export class TrelloSyncRunService extends TenantAwareCrudService<TrelloSyncRun> {
	constructor(
		readonly typeOrmTrelloSyncRunRepository: TypeOrmTrelloSyncRunRepository,
		readonly mikroOrmTrelloSyncRunRepository: MikroOrmTrelloSyncRunRepository,
		private readonly dataSource: DataSource
	) {
		super(typeOrmTrelloSyncRunRepository, mikroOrmTrelloSyncRunRepository);
	}

	/** The latest runs of a connection, newest first. */
	async list(tenant: IIntegrationTenant, take = 50): Promise<TrelloSyncRun[]> {
		return this.typeOrmTrelloSyncRunRepository.find({
			where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID },
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(take, 1), 200)
		});
	}

	/** Whether an import of the mapping is live now (running, with progress within the stale window). */
	async hasRunning(mappingId: ID): Promise<boolean> {
		const count = await this.typeOrmTrelloSyncRunRepository.count({
			where: { mappingId, kind: TrelloSyncRunKind.IMPORT, status: TrelloSyncRunStatus.RUNNING, updatedAt: MoreThanOrEqual(new Date(Date.now() - TRELLO_IMPORT_STALE_MS)) }
		});
		return count > 0;
	}

	/**
	 * Claims the mapping for one import: in one transaction (serialised per mapping on Postgres with an advisory
	 * lock), abandoned runs are failed, a live one refuses the claim (409), and the new run is written.
	 */
	async claimImport(tenant: IIntegrationTenant, mapping: TrelloBoardMapping, input: { full?: boolean; requestedByUserId?: ID | null }): Promise<TrelloSyncRun> {
		return this.dataSource.transaction(async (manager) => {
			// Every writer of the mapping's runs is serialized: an advisory lock on Postgres (a parameterized
			// statement, the key a bind value), the mapping's row locked on MySQL / MariaDB; SQLite serializes writers.
			const dialect = manager.connection.options.type;
			if (dialect === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integration-trello:import:${mapping.id}`]);
			} else if (dialect === 'mysql' || dialect === 'mariadb') {
				await manager.findOne(TrelloBoardMapping, { where: { id: mapping.id } as never, lock: { mode: 'pessimistic_write' } });
			}
			const staleBefore = new Date(Date.now() - TRELLO_IMPORT_STALE_MS);
			await manager.update(
				TrelloSyncRun,
				{ mappingId: mapping.id, kind: TrelloSyncRunKind.IMPORT, status: TrelloSyncRunStatus.RUNNING, updatedAt: LessThan(staleBefore) },
				{ status: TrelloSyncRunStatus.FAILED, finishedAt: new Date(), lastError: 'Abandoned: no progress for 30 minutes (the process stopped).', updatedAt: new Date() } as never
			);
			const live = await manager.count(TrelloSyncRun, { where: { mappingId: mapping.id, kind: TrelloSyncRunKind.IMPORT, status: TrelloSyncRunStatus.RUNNING } });
			if (live > 0) {
				throw new ConflictException({ message: 'An import of this mapping is running', code: TRELLO_RUN_IN_PROGRESS });
			}
			const run = Object.assign(new TrelloSyncRun(), {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				organizationId: tenant.organizationId as ID,
				mappingId: mapping.id,
				kind: TrelloSyncRunKind.IMPORT,
				status: TrelloSyncRunStatus.RUNNING,
				full: !!input.full,
				requestedByUserId: input.requestedByUserId ?? null,
				startedAt: new Date()
			});
			return manager.save(TrelloSyncRun, run);
		});
	}

	/** A webhook application: one delivery, no claim needed. */
	async startWebhookRun(tenant: IIntegrationTenant, mappingId: ID): Promise<TrelloSyncRun> {
		const run = Object.assign(new TrelloSyncRun(), {
			integrationId: tenant.id as ID,
			tenantId: tenant.tenantId as ID,
			organizationId: tenant.organizationId as ID,
			mappingId,
			kind: TrelloSyncRunKind.WEBHOOK,
			status: TrelloSyncRunStatus.RUNNING,
			full: false,
			requestedByUserId: null,
			startedAt: new Date()
		});
		return this.typeOrmTrelloSyncRunRepository.save(run);
	}

	async finish(run: TrelloSyncRun, outcome: { counts: TrelloSyncCounts; cursor?: string | null; error?: string | null }): Promise<void> {
		await this.typeOrmTrelloSyncRunRepository.update(
			{ id: run.id },
			{
				status: outcome.error ? TrelloSyncRunStatus.FAILED : TrelloSyncRunStatus.DONE,
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
		if (run.kind === TrelloSyncRunKind.WEBHOOK) {
			// One row per delivery on a busy project: the old ones go (the imports stay).
			await this.typeOrmTrelloSyncRunRepository
				.delete({ integrationId: run.integrationId, kind: TrelloSyncRunKind.WEBHOOK, createdAt: LessThan(new Date(Date.now() - TRELLO_WEBHOOK_RUN_RETENTION_MS)) })
				.catch(() => undefined);
		}
	}

	/** Counts of a run in progress: the heartbeat that keeps it live. */
	async progress(run: TrelloSyncRun, counts: TrelloSyncCounts): Promise<void> {
		await this.typeOrmTrelloSyncRunRepository
			.update({ id: run.id }, { createdCount: counts.created, updatedCount: counts.updated, skippedCount: counts.skipped, failedCount: counts.failed, updatedAt: new Date() } as never)
			.catch(() => undefined);
	}
}
