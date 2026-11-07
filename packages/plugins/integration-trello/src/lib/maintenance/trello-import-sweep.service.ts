import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { IsNull, LessThan, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { TrelloConfig } from '../trello-config';
import { trelloSyncUser, runInTrelloContext } from '../trello-process';
import { TrelloSyncRunService } from '../trello-sync-run.service';
import { TrelloTenantService } from '../trello-tenant.service';
import { TRELLO_CONFIG, TRELLO_IMPORT_SWEEP_BATCH, TRELLO_IMPORT_SWEEP_SLACK_MS, TRELLO_IMPORT_WEBHOOK_STRIDE } from '../trello.constants';
import { TrelloBoardMapping, TrelloSyncDirection, TypeOrmTrelloBoardMappingRepository } from '../entities/trello-board-mapping.entity';
import { TrelloSyncService } from '../sync/trello-sync.service';

/** What one sweep did. */
export interface TrelloImportSweepOutcome {
	/** The mappings that were due. */
	due: number;
	/** The imports that ran (each is a run of its mapping, like one a person asked for). */
	imported: number;
	/** The mappings left alone: an import already running, a connection gone, or one waiting for a person. */
	skipped: number;
	/** The mappings whose import could not even start (reported; the next sweep tries again). */
	failed: number;
}

/**
 * The scheduled import: every mapping that brings cards in (`inbound` or `both`, sync on) whose last import is older
 * than the interval (`TRELLO_IMPORT_INTERVAL_MINUTES`) is imported again — the changes since its position, the
 * same incremental read "import now" makes — so a connection without a public address for webhooks still follows
 * Trello; one with a live webhook (`webhookId`) every fourth interval (`TRELLO_IMPORT_WEBHOOK_STRIDE`), a reconcile against deliveries that were missed. A mapping never imported is due at once.
 *
 * **A sweep has no caller and therefore no tenant in context.** The due mappings are read across tenants with the
 * plain repository, and each import opens the request context of its own tenant and organization (signed in as the
 * sync's user) before anything that reads the context runs — the connection lookup, the claim, the writes. The
 * claim is the one "import now" takes, so a sweep and a person never import one mapping at once, and two sweeps
 * that overlap skip each other's mappings instead of racing.
 *
 * The longest waiting go first and a sweep takes at most `TRELLO_IMPORT_SWEEP_BATCH` of them: a backlog is cleared
 * over a few sweeps rather than in one pass that holds the worker. A connection whose token was refused is left to
 * the person who must reconnect it (the attention the sync recorded), not asked again every interval. A mapping
 * whose import could not start is reported and left for the next sweep; a failure inside an import is the run's
 * (the sync records it on the run and the mapping), not the sweep's.
 */
@Injectable()
export class TrelloImportSweepService {
	private readonly logger = new Logger(TrelloImportSweepService.name);

	constructor(
		private readonly mappings: TypeOrmTrelloBoardMappingRepository,
		private readonly tenants: TrelloTenantService,
		private readonly runs: TrelloSyncRunService,
		private readonly sync: TrelloSyncService,
		@Inject(TRELLO_CONFIG) private readonly config: TrelloConfig
	) {}

	/** Imports every mapping that is due, the longest waiting first, and says what happened. */
	async run(now = new Date()): Promise<TrelloImportSweepOutcome> {
		const outcome: TrelloImportSweepOutcome = { due: 0, imported: 0, skipped: 0, failed: 0 };
		if (this.config.importIntervalMinutes <= 0) return outcome;
		const due = await this.findDue(now);
		outcome.due = due.length;
		for (const mapping of due) {
			try {
				if (await this.importOne(mapping)) outcome.imported += 1;
				else outcome.skipped += 1;
			} catch (error) {
				outcome.failed += 1;
				this.logger.warn(`The scheduled import of mapping ${mapping.id} could not start: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (outcome.due > 0) {
			this.logger.log(`Scheduled Trello import: ${outcome.imported} imported, ${outcome.skipped} skipped, ${outcome.failed} failed of ${outcome.due} due`);
		}
		return outcome;
	}

	/** The inbound mappings whose last import is older than their interval (or that were never imported), the oldest first. */
	async findDue(now: Date): Promise<TrelloBoardMapping[]> {
		const interval = this.config.importIntervalMinutes * 60_000;
		const before = (factor: number) => new Date(now.getTime() - interval * factor + TRELLO_IMPORT_SWEEP_SLACK_MS);
		const inbound = { syncEnabled: true, direction: Not(TrelloSyncDirection.OUTBOUND) };
		return this.mappings.find({
			where: [
				{ ...inbound, lastImportedAt: IsNull() },
				{ ...inbound, webhookId: IsNull(), lastImportedAt: LessThan(before(1)) },
				{ ...inbound, webhookId: Not(IsNull()), lastImportedAt: LessThan(before(TRELLO_IMPORT_WEBHOOK_STRIDE)) }
			] as never,
			order: { lastImportedAt: 'ASC' },
			take: TRELLO_IMPORT_SWEEP_BATCH
		});
	}

	/** Imports one mapping inside its own tenant's context; `false` when it was left alone. */
	private async importOne(mapping: TrelloBoardMapping): Promise<boolean> {
		const scope = { tenantId: mapping.tenantId as ID, organizationId: mapping.organizationId as ID };
		return runInTrelloContext(trelloSyncUser(scope, null), async () => {
			// The connection is gone or inactive: its mappings are not imported (they go with it).
			const tenant = await this.tenants.requireById(mapping.integrationId).catch(() => null);
			if (!tenant) return false;
			// A refused token: a person must reconnect first; asking Trello again every interval changes nothing.
			if (this.tenants.summaryOf(tenant).attentionReason) return false;
			let run;
			try {
				run = await this.runs.claimImport(tenant, mapping, { full: false, requestedByUserId: null });
			} catch (error) {
				// An import is running already: a person's, or an overlapping sweep's.
				if (error instanceof ConflictException) return false;
				throw error;
			}
			await this.sync.importMapping(tenant, mapping, run);
			return true;
		});
	}
}
