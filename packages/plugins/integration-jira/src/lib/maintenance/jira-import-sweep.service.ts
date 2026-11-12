import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { IsNull, LessThan, Not } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { JiraCloudConfig, jiraWebhooksEnabled } from '../jira-config';
import { jiraSyncUser, runInJiraContext } from '../jira-process';
import { JiraSyncRunService } from '../jira-sync-run.service';
import { JiraTenantService } from '../jira-tenant.service';
import { JIRA_CONFIG, JIRA_IMPORT_SWEEP_BATCH, JIRA_IMPORT_SWEEP_SLACK_MS, JIRA_IMPORT_WEBHOOK_STRIDE } from '../jira.constants';
import { JiraProjectMapping, JiraSyncDirection, TypeOrmJiraProjectMappingRepository } from '../entities/jira-project-mapping.entity';
import { JiraSyncService } from '../sync/jira-sync.service';
import { JiraWebhookService } from '../sync/jira-webhook.service';

/** What one sweep did. */
export interface JiraImportSweepOutcome {
	/** The refused connections whose notice was filed again (the Inbox had not taken it yet). */
	attention: number;
	/** The connections whose webhook was registered, refreshed (before Jira's 30-day expiry) or removed. */
	webhooks: number;
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
 * The scheduled import: every mapping that brings issues in (`inbound` or `both`, sync on) whose last import is older
 * than the interval (`JIRA_IMPORT_INTERVAL_MINUTES`) is imported again — the changes since its position, the
 * same incremental read "import now" makes — so a connection without a public address for webhooks still follows
 * Jira; every fourth interval (`JIRA_IMPORT_WEBHOOK_STRIDE`) when the connections take webhooks (an HTTPS `JIRA_WEBHOOK_URL` or `API_BASE_URL`), a reconcile against deliveries that were missed. A mapping never imported is due at once.
 *
 * **A sweep has no caller and therefore no tenant in context.** The due mappings are read across tenants with the
 * plain repository, their connections with the tenant-less lookup, and each import opens the request context of its
 * own tenant and organization (signed in as the sync's user) before anything that reads the context runs — the
 * mapping's re-read, the claim, the writes. The claim is the one "import now" takes, so a sweep and a person never
 * import one mapping at once, and two sweeps that overlap skip each other's mappings instead of racing.
 *
 * The connections are settled before the batch is cut: one that is gone, or whose token was refused (the attention
 * the sync recorded — a person must reconnect it, and asking Jira again every interval changes nothing), takes
 * its mappings out of the sweep, so they never hold the front of the queue against the mappings behind them. Of
 * what is left, the longest waiting go first — a mapping never imported before any other, whatever the database
 * makes of a null in an order (PostgreSQL puts it last) — and a sweep takes at most `JIRA_IMPORT_SWEEP_BATCH`: a backlog is
 * cleared over a few sweeps rather than in one pass that holds the worker. Each mapping is read again inside its
 * context right before its claim — the sweep's list is minutes old by then, and a mapping switched off, turned
 * outbound or removed meanwhile is left alone. A mapping whose import could not start is reported and left for the
 * next sweep; a failure inside an import is the run's (the sync records it on the run and the mapping), not the
 * sweep's.
 */
@Injectable()
export class JiraImportSweepService {
	private readonly logger = new Logger(JiraImportSweepService.name);

	constructor(
		private readonly mappings: TypeOrmJiraProjectMappingRepository,
		private readonly tenants: JiraTenantService,
		private readonly runs: JiraSyncRunService,
		private readonly sync: JiraSyncService,
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		private readonly webhooks: JiraWebhookService
	) {}

	/** Imports every mapping that is due, the longest waiting first, and says what happened. */
	async run(now = new Date()): Promise<JiraImportSweepOutcome> {
		const outcome: JiraImportSweepOutcome = { attention: 0, webhooks: 0, due: 0, imported: 0, skipped: 0, failed: 0 };
		// First, and whatever the mappings: the notices the Inbox has not taken yet.
		outcome.attention = await this.retryAttention();
		// Then the webhooks, whatever the interval: a dynamic webhook lapses 30 days after its registration or last refresh.
		outcome.webhooks = await this.keepWebhooks(now);
		if (this.config.importIntervalMinutes <= 0) return outcome;
		const due = waitingFirst(await this.findDue(now));
		const batch = (await this.withConnections(due)).filter(({ tenant, mapping }) => this.isDue(tenant, mapping, now)).slice(0, JIRA_IMPORT_SWEEP_BATCH);
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
			this.logger.log(`Scheduled Jira import: ${outcome.imported} imported, ${outcome.skipped} skipped, ${outcome.failed} failed of ${outcome.due} due`);
		}
		return outcome;
	}

	/**
	 * The inbound mappings whose last import is older than one interval, or that were never imported (the order is decided
	 * by the caller). Whether one with a working webhook waits longer is decided per connection ({@link isDue}).
	 */
	async findDue(now: Date): Promise<JiraProjectMapping[]> {
		const interval = this.config.importIntervalMinutes * 60_000;
		const before = new Date(now.getTime() - interval + JIRA_IMPORT_SWEEP_SLACK_MS);
		const inbound = { syncEnabled: true, direction: Not(JiraSyncDirection.OUTBOUND) };
		return this.mappings.find({
			where: [
				{ ...inbound, lastImportedAt: IsNull() },
				{ ...inbound, lastImportedAt: LessThan(before) }
			] as never
		});
	}

	/**
	 * Whether a listed mapping is due now: never imported, or older than its interval. A mapping whose connection has a
	 * working webhook (registered, unexpired, its last registration not failed) waits four intervals, a reconcile of
	 * missed deliveries; any other follows Jira every interval, its only feed.
	 */
	isDue(tenant: IIntegrationTenant, mapping: Pick<JiraProjectMapping, 'lastImportedAt'>, now: Date): boolean {
		if (!mapping.lastImportedAt) return true;
		const summary = this.tenants.summaryOf(tenant);
		const expiresAt = summary.webhookExpiresAt ? Date.parse(summary.webhookExpiresAt) : NaN;
		const webhookWorks =
			jiraWebhooksEnabled(this.config) && this.tenants.webhookIdsOf(tenant).length > 0 && !summary.webhookError && Number.isFinite(expiresAt) && expiresAt > now.getTime();
		const factor = webhookWorks ? JIRA_IMPORT_WEBHOOK_STRIDE : 1;
		return new Date(mapping.lastImportedAt).getTime() < now.getTime() - this.config.importIntervalMinutes * 60_000 * factor + JIRA_IMPORT_SWEEP_SLACK_MS;
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

	/**
	 * Keeps the webhook of every connection that works (a site chosen, no refusal waiting for a person) in line with its
	 * mappings, and refreshes it when it is within a week of its expiry; each in its own tenant's context. Nothing when
	 * webhooks are off.
	 */
	private async keepWebhooks(now: Date): Promise<number> {
		if (!jiraWebhooksEnabled(this.config)) return 0;
		let kept = 0;
		for (const tenant of await this.tenants.findAllConnected()) {
			const summary = this.tenants.summaryOf(tenant);
			if (summary.siteRequired || summary.attentionReason) continue;
			try {
				const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
				const outcome = await runInJiraContext(jiraSyncUser(scope, null), () => this.webhooks.ensure(tenant, now.getTime()));
				if (outcome === 'registered' || outcome === 'refreshed' || outcome === 'removed') kept += 1;
			} catch (error) {
				this.logger.warn(`The webhook of connection ${tenant.id} could not be kept from the sweep: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return kept;
	}

	private async withConnections(mappings: JiraProjectMapping[]): Promise<Array<{ tenant: IIntegrationTenant; mapping: JiraProjectMapping }>> {
		const connections = new Map<string, IIntegrationTenant | null>();
		const result: Array<{ tenant: IIntegrationTenant; mapping: JiraProjectMapping }> = [];
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
	private async importOne(tenant: IIntegrationTenant, listed: JiraProjectMapping): Promise<boolean> {
		const scope = { tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID };
		return runInJiraContext(jiraSyncUser(scope, null), async () => {
			// As the mapping is now, not as it was listed: one switched off, turned outbound or removed meanwhile brings nothing in.
			const mapping = await this.mappings.findOne({ where: { id: listed.id, tenantId: scope.tenantId } as never });
			if (!mapping || !mapping.syncEnabled || mapping.direction === JiraSyncDirection.OUTBOUND) return false;
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
export function waitingFirst(mappings: JiraProjectMapping[]): JiraProjectMapping[] {
	const at = (mapping: JiraProjectMapping): number => (mapping.lastImportedAt ? new Date(mapping.lastImportedAt).getTime() : 0);
	return [...mappings].sort((a, b) => at(a) - at(b));
}
