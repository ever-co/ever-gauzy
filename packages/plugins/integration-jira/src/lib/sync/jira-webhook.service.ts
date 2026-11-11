import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { JiraApiClient, JiraApiError } from '../client/jira-api.client';
import { JiraProjectMapping, JiraSyncDirection, TypeOrmJiraProjectMappingRepository } from '../entities/jira-project-mapping.entity';
import { JiraCloudConfig, jiraWebhookTargetOf } from '../jira-config';
import { JiraTenantService } from '../jira-tenant.service';
import { JIRA_CONFIG, JIRA_WEBHOOK_EVENTS, JIRA_WEBHOOK_LIFETIME_MS, JIRA_WEBHOOK_REFRESH_AHEAD_MS, JiraSettingName } from '../jira.constants';

/** What one look at a connection's webhook did. */
export type JiraWebhookOutcome = 'off' | 'unchanged' | 'registered' | 'refreshed' | 'removed' | 'failed';

/**
 * The JQL filter of a connection's webhook: the projects its inbound mappings bring in (each once, in order), or null
 * when none does (the connection then needs no webhook). A dynamic webhook's filter takes `project in (…)`; the issue
 * types a mapping takes are filtered when a delivery is applied.
 */
export function webhookJqlOf(mappings: ReadonlyArray<Pick<JiraProjectMapping, 'jiraProjectId' | 'direction' | 'syncEnabled'>>): string | null {
	const projects = [
		...new Set(
			mappings
				.filter((mapping) => mapping.syncEnabled && mapping.direction !== JiraSyncDirection.OUTBOUND && /^\d{1,20}$/.test(String(mapping.jiraProjectId)))
				.map((mapping) => String(mapping.jiraProjectId))
		)
	].sort((a, b) => Number(a) - Number(b));
	return projects.length ? `project in (${projects.join(', ')})` : null;
}

/** Whether a webhook expiring at `expiresAt` is due for a refresh (an unknown expiry is). */
export function isWebhookRefreshDue(expiresAt: string | null | undefined, now = Date.now()): boolean {
	if (!expiresAt) return true;
	const at = Date.parse(expiresAt);
	return !Number.isFinite(at) || at - now <= JIRA_WEBHOOK_REFRESH_AHEAD_MS;
}

/**
 * The dynamic webhook of each connection: one registration per connection, for the projects its inbound mappings bring
 * in, delivering to `/integration/jira/webhook/<connection id>`. Kept as the mappings change (a new filter replaces the
 * former registration), refreshed before Jira's 30-day expiry by the scheduled sweep, registered again when Jira no
 * longer knows it, and removed on a disconnect. Best effort throughout: without webhooks (no HTTPS address, a refusal)
 * the scheduled import follows Jira every interval instead of every fourth, and the error is shown on the connection.
 */
@Injectable()
export class JiraWebhookService {
	private readonly logger = new Logger(JiraWebhookService.name);
	/** The look in flight of each connection: two mapping changes never register twice. */
	private readonly chains = new Map<string, Promise<JiraWebhookOutcome>>();

	constructor(
		private readonly tenants: JiraTenantService,
		private readonly mappings: TypeOrmJiraProjectMappingRepository,
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig
	) {}

	/** Brings the connection's webhook in line with its mappings and refreshes it when due; one look at a time per connection. */
	ensure(tenant: IIntegrationTenant, now = Date.now()): Promise<JiraWebhookOutcome> {
		const key = String(tenant.id);
		const previous = this.chains.get(key) ?? Promise.resolve<JiraWebhookOutcome>('unchanged');
		const next = previous
			.catch(() => 'failed' as JiraWebhookOutcome)
			.then(() => this.ensureNow(tenant, now))
			.finally(() => {
				if (this.chains.get(key) === next) this.chains.delete(key);
			});
		this.chains.set(key, next);
		return next;
	}

	/** Removes the connection's webhooks from Jira (a disconnect, a move to another site); true when Jira has none left. */
	async remove(tenant: IIntegrationTenant): Promise<boolean> {
		const ids = this.tenants.webhookIdsOf(tenant);
		if (!ids.length) return true;
		try {
			await this.call(tenant, (client) => client.deleteWebhooks(ids));
			return true;
		} catch (error) {
			this.logger.warn(`The Jira webhook of connection ${tenant.id} could not be removed: ${this.describe(error)}`);
			return false;
		}
	}

	private async ensureNow(tenant: IIntegrationTenant, now: number): Promise<JiraWebhookOutcome> {
		const settings = this.tenants.settingsOf(tenant);
		if (!settings[JiraSettingName.JIRA_CLOUD_ID] || settings[JiraSettingName.ATTENTION_REASON]) return 'off';
		const target = jiraWebhookTargetOf(this.config, String(tenant.id));
		const ids = this.tenants.webhookIdsOf(tenant);
		const mappings = await this.mappings.find({ where: { integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } as never });
		const jql = target ? webhookJqlOf(mappings) : null;
		try {
			if (!jql) {
				// No webhook wanted (none of the mappings brings issues in, or webhooks are off): the former one goes.
				if (!ids.length) return target ? 'unchanged' : 'off';
				await this.call(tenant, (client) => client.deleteWebhooks(ids));
				await this.tenants.recordWebhook(tenant, { ids: [], jql: '', expiresAt: null, error: null });
				return 'removed';
			}
			if (ids.length && settings[JiraSettingName.WEBHOOK_JQL] === jql) {
				if (!isWebhookRefreshDue(settings[JiraSettingName.WEBHOOK_EXPIRES_AT], now)) return 'unchanged';
				try {
					const expiresAt = (await this.call(tenant, (client) => client.refreshWebhooks(ids))) ?? new Date(now + JIRA_WEBHOOK_LIFETIME_MS).toISOString();
					await this.tenants.recordWebhook(tenant, { ids, jql, expiresAt, error: null });
					return 'refreshed';
				} catch (error) {
					// Jira no longer knows the webhook (it lapsed past its grace, or was removed): registered again below.
					if (!(error instanceof JiraApiError) || (error.status !== 404 && error.status !== 400)) throw error;
				}
			}
			// A new filter (or none registered yet): the former registration goes first, then the new one is made.
			if (ids.length) await this.call(tenant, (client) => client.deleteWebhooks(ids)).catch(() => undefined);
			const results = await this.call(tenant, (client) => client.registerWebhooks(target as string, [{ events: JIRA_WEBHOOK_EVENTS, jqlFilter: jql }]));
			const created = results.map((result) => result.createdWebhookId).filter((id) => id !== undefined && id !== null).map(String);
			if (!created.length) {
				const reason = results.flatMap((result) => result.errors ?? []).join('; ') || 'Jira registered no webhook';
				await this.tenants.recordWebhook(tenant, { ids: [], jql: '', expiresAt: null, error: reason });
				this.logger.warn(`The Jira webhook of connection ${tenant.id} was not registered: ${reason}`);
				return 'failed';
			}
			await this.tenants.recordWebhook(tenant, { ids: created, jql, expiresAt: new Date(now + JIRA_WEBHOOK_LIFETIME_MS).toISOString(), error: null });
			return 'registered';
		} catch (error) {
			this.logger.warn(`The Jira webhook of connection ${tenant.id} could not be kept: ${this.describe(error)}`);
			await this.tenants.recordWebhookError(tenant, this.describe(error)).catch(() => undefined);
			if (error instanceof JiraApiError && error.isUnauthorized) {
				await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN] ?? null).catch(() => undefined);
			}
			return 'failed';
		}
	}

	/** One call with the connection's client, its token renewed once when Jira refused it. */
	private async call<T>(tenant: IIntegrationTenant, make: (client: JiraApiClient) => Promise<T>): Promise<T> {
		const client = await this.tenants.clientReady(tenant);
		try {
			return await make(client);
		} catch (error) {
			if (error instanceof JiraApiError && error.isUnauthorized) {
				const renewed = await this.tenants.refreshAccessToken(tenant);
				if (renewed) return make(renewed);
			}
			throw error;
		}
	}

	private describe(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
