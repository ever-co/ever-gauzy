import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { IsNull, LessThan, Not } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { AsanaConfig } from '../asana-config';
import { asanaSyncUser, runInAsanaContext } from '../asana-process';
import { AsanaSyncRunService } from '../asana-sync-run.service';
import { AsanaTenantService } from '../asana-tenant.service';
import { ASANA_CONFIG, ASANA_IMPORT_SWEEP_BATCH, ASANA_IMPORT_SWEEP_SLACK_MS, ASANA_IMPORT_WEBHOOK_STRIDE } from '../asana.constants';
import { AsanaProjectMapping, AsanaSyncDirection, TypeOrmAsanaProjectMappingRepository } from '../entities/asana-project-mapping.entity';
import { AsanaSyncService } from '../sync/asana-sync.service';

/** What one sweep did. */
export interface AsanaImportSweepOutcome {
	/** The refused connections whose notice was filed again (the Inbox had not taken it yet). */
	attention: number;
	/** The mappings that were due (those of a connection that is gone or waits for a person are not counted). */
	due: number;
	/** The imports that ran (each is a run of its mapping, like one a person asked for). */
	imported: number;
	/** The mappings left alone: an import already running, or a mapping switched off, turned outbound or removed meanwhile. */
	skipped: number;
	/** The mappings whose import could not even start (reported; the next sweep tries again). */
	failed: number;
}

/**
 * The scheduled import: every mapping that brings tasks in (`inbound` or `both`, sync on) whose last import is older
 * than the interval (`ASANA_IMPORT_INTERVAL_MINUTES`) is imported again — the changes since its position, the
 * same incremental read "import now" makes — so a connection without a public address for webhooks still follows
 * Asana; one with a live webhook (`webhookGid`) every fourth interval (`ASANA_IMPORT_WEBHOOK_STRIDE`), a reconcile against deliveries that were missed. A mapping never imported is due at once.
 *
 * **A sweep has no caller and therefore no tenant in context.** The due mappings are read across tenants with the
 * plain repository, their connections with the tenant-less lookup, and each import opens the request context of its
 * own tenant and organization (signed in as the sync's user) before anything that reads the context runs — the
 * mapping's re-read, the claim, the writes. The claim is the one "import now" takes, so a sweep and a person never
 * import one mapping at once, and two sweeps that overlap skip each other's mappings instead of racing.
 *
 * The connections are settled before the batch is cut: one that is gone, or whose token was refused (the attention
 * the sync recorded — a person must reconnect it, and asking Asana again every interval changes nothing), takes
 * its mappings out of the sweep, so they never hold the front of the queue against the mappings behind them. Of
 * what is left, the longest waiting go first — a mapping never imported before any other, whatever the database
 * makes of a null in an order (PostgreSQL puts it last) — and a sweep takes at most `ASANA_IMPORT_SWEEP_BATCH`: a backlog is
 * cleared over a few sweeps rather than in one pass that holds the worker. Each mapping is read again inside its
 * context right before its claim — the sweep's list is minutes old by then, and a mapping switched off, turned
 * outbound or removed meanwhile is left alone. A mapping whose import could not start is reported and left for the
 * next sweep; a failure inside an import is the run's (the sync records it on the run and the mapping), not the
 * sweep's.
 */
@Injectable()
export class AsanaImportSweepService {
	private readonly logger = new Logger(AsanaImportSweepService.name);

	constructor(
		private readonly mappings: TypeOrmAsanaProjectMappingRepository,
		private readonly tenants: AsanaTenantService,
		private readonly runs: AsanaSyncRunService,
		private readonly sync: AsanaSyncService,
		@Inject(ASANA_CONFIG) private readonly config: AsanaConfig
	) {}

	/** Imports every mapping that is due, the longest waiting first, and says what happened. */
	async run(now = new Date()): Promise<AsanaImportSweepOutcome> {
		const outcome: AsanaImportSweepOutcome = { attention: 0, due: 0, imported: 0, skipped: 0, failed: 0 };
		// First, and whatever the mappings: the notices the Inbox has not taken yet.
		outcome.attention = await this.retryAttention();
		if (this.config.importIntervalMinutes <= 0) return outcome;
		const due = waitingFirst(await this.findDue(now));
		const batch = (await this.withConnections(due)).slice(0, ASANA_IMPORT_SWEEP_BATCH);
		outcome.due = batch.length;
		for (const { tenant, mapping } of batch) {
			try {
				if (await this.importOne(tenant, mapping)) outcome.imported += 1;
				else outcome.skipped += 1;
			} catch (error) {
				outcome.failed += 1;
				this.logger.warn(`The scheduled import of mapping ${mapping.id} could not start: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (outcome.due > 0) {
			this.logger.log(`Scheduled Asana import: ${outcome.imported} imported, ${outcome.skipped} skipped, ${outcome.failed} failed of ${outcome.due} due`);
		}
		return outcome;
	}

	/** The inbound mappings whose last import is older than their interval, or that were never imported (the order is decided by the caller). */
	async findDue(now: Date): Promise<AsanaProjectMapping[]> {
		const interval = this.config.importIntervalMinutes * 60_000;
		const before = (factor: number) => new Date(now.getTime() - interval * factor + ASANA_IMPORT_SWEEP_SLACK_MS);
		const inbound = { syncEnabled: true, direction: Not(AsanaSyncDirection.OUTBOUND) };
		return this.mappings.find({
			where: [
				{ ...inbound, lastImportedAt: IsNull() },
				{ ...inbound, webhookGid: IsNull(), lastImportedAt: LessThan(before(1)) },
				{ ...inbound, webhookGid: Not(IsNull()), lastImportedAt: LessThan(before(ASANA_IMPORT_WEBHOOK_STRIDE)) }
			] as never
		});
	}

	/**
	 * The mappings with their connection, in the same order, without those of a connection that is gone (its mappings go
	 * with it) or that waits for a person (an attention reason: a refused token). Each connection is read once.
	 */
	/**
	 * Files again the notice of every refused connection whose filing did not get through, whatever its mappings
	 * (none, outbound, switched off, imported a moment ago): the retry waits for no import, only for the sweep.
	 */
	private async retryAttention(): Promise<number> {
		let filed = 0;
		for (const tenant of await this.tenants.findRefusedUnfiled()) {
			try {
				await this.tenants.ensureAttentionFiled(tenant);
				filed += 1;
			} catch (error) {
				this.logger.warn(`The attention of connection ${tenant.id} could not be filed from the sweep: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return filed;
	}

	private async withConnections(mappings: AsanaProjectMapping[]): Promise<Array<{ tenant: IIntegrationTenant; mapping: AsanaProjectMapping }>> {
		const connections = new Map<string, IIntegrationTenant | null>();
		const result: Array<{ tenant: IIntegrationTenant; mapping: AsanaProjectMapping }> = [];
		for (const mapping of mappings) {
			const key = String(mapping.integrationId);
			if (!connections.has(key)) {
				const tenant = await this.tenants.findAnyById(mapping.integrationId);
				connections.set(key, tenant && !this.tenants.summaryOf(tenant).attentionReason ? tenant : null);
			}
			const tenant = connections.get(key);
			if (tenant) result.push({ tenant, mapping });
		}
		return result;
	}

	/** Imports one mapping inside its own tenant's context; `false` when it was left alone. */
	private async importOne(tenant: IIntegrationTenant, listed: AsanaProjectMapping): Promise<boolean> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		return runInAsanaContext(asanaSyncUser(scope, null), async () => {
			// As the mapping is now, not as it was listed: one switched off, turned outbound or removed meanwhile brings nothing in.
			const mapping = await this.mappings.findOne({ where: { id: listed.id, tenantId: scope.tenantId } as never });
			if (!mapping || !mapping.syncEnabled || mapping.direction === AsanaSyncDirection.OUTBOUND) return false;
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

/** The mappings by how long they waited: never imported first, then the oldest import first (a stable order within a tie). */
export function waitingFirst(mappings: AsanaProjectMapping[]): AsanaProjectMapping[] {
	const at = (mapping: AsanaProjectMapping): number => (mapping.lastImportedAt ? new Date(mapping.lastImportedAt).getTime() : 0);
	return [...mappings].sort((a, b) => at(a) - at(b));
}
