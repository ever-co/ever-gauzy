import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ID, IInboxItemWriter, IIntegrationSetting, IIntegrationTenant, INBOX_ITEM_WRITER, IntegrationEntity } from '@gauzy/contracts';
import {
	Integration,
	INTEGRATION_MANAGERS_LIMIT,
	IntegrationSettingService,
	IntegrationTenantService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext
} from '@gauzy/core';
import { JiraApiClient, JiraMyself, JiraOAuthToken, JiraSite, refreshJiraToken } from './client/jira-api.client';
import { ATTENTION_NOTICE_DEFERRED, attentionItemOf } from './jira-attention';
import { JiraCloudConfig } from './jira-config';
import {
	JIRA_CONFIG,
	JIRA_INTEGRATION_NAME,
	JIRA_NOT_CONNECTED,
	JIRA_SITE_REQUIRED,
	JIRA_TOKEN_REFRESH_AHEAD_MS,
	JiraSettingName
} from './jira.constants';

/** The settings of a connection as a map (`settingsName` → `settingsValue`). */
export type JiraSettings = Partial<Record<JiraSettingName, string>>;

/** What the routes answer about a connection (never a token). */
export interface JiraConnectionSummary {
	id: ID;
	organizationId: ID;
	/** The Jira Cloud site the connection works with; null until one is chosen (the token reaches several). */
	cloudId: string | null;
	siteUrl: string | null;
	siteName: string | null;
	/** The Atlassian account the token is. */
	accountId: string | null;
	accountName: string | null;
	/** Whether a site must still be chosen (`PUT …/site`) before anything else works. */
	siteRequired: boolean;
	/** The dynamic webhook of the connection: when it expires (refreshed before), and why its last registration failed. */
	webhookExpiresAt: string | null;
	webhookError: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	tokenExpiresAt: string | null;
	lastSyncedAt: Date | null;
	createdAt: Date | null;
}

/**
 * The connected organizations: each is an `integration_tenant` named `Jira` whose settings hold the
 * OAuth tokens and the Jira Cloud site they work with. The tokens are written only here and read only by
 * {@link clientFor} / {@link clientReady}; no route answers them. An access token near its expiry is
 * renewed with the refresh token before use, one renewal at a time per connection, and the pair is rotated.
 */
@Injectable()
export class JiraTenantService {
	private readonly logger = new Logger(JiraTenantService.name);
	/** The renewal in flight of each connection, so two callers never spend the same refresh token. */
	private readonly refreshing = new Map<string, Promise<JiraApiClient | null>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		/** The Inbox, when its plugin is loaded: the person who connected and the integration's managers hear there of a refused token. */
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null
	) {}

	/** The connection of an organization in the current tenant, with its settings, or null. */
	async forOrganization(organizationId: ID, tenantId: ID = RequestContext.currentTenantId() as ID): Promise<IIntegrationTenant | null> {
		if (!tenantId || !organizationId) return null;
		return this.integrationTenantService
			.findOneByOptions({
				where: { name: JIRA_INTEGRATION_NAME, tenantId, organizationId, isActive: true, isArchived: false },
				relations: { settings: true },
				order: { createdAt: 'DESC' }
			})
			.catch(() => null);
	}

	/** A connection by id with its settings, in whatever tenant, or null: for work with no request context (a sweep). */
	async findAnyById(integrationId: ID): Promise<IIntegrationTenant | null> {
		return this.integrationTenantService['typeOrmRepository']
			.findOne({ where: { id: integrationId, name: JIRA_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch((error: unknown) => {
				// A connection the store could not read is not a missing one, but the caller can do no more with it either.
				this.logger.warn(`Connection ${integrationId} could not be read: ${error instanceof Error ? error.message : String(error)}`);
				return null;
			}) as Promise<IIntegrationTenant | null>;
	}

	/** A connection by id, in the current tenant, with its settings; 404 otherwise. */
	async requireById(integrationId: ID): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const tenant = await this.integrationTenantService
			.findOneByIdString(integrationId, {
				where: { name: JIRA_INTEGRATION_NAME, tenantId: tenantId as ID, isActive: true, isArchived: false },
				relations: { settings: true }
			})
			.catch(() => null);
		if (!tenant) {
			throw new NotFoundException({ message: 'The Jira connection was not found', code: JIRA_NOT_CONNECTED });
		}
		return tenant;
	}

	settingsOf(tenant: IIntegrationTenant): JiraSettings {
		const result: JiraSettings = {};
		for (const setting of tenant.settings ?? []) {
			if (setting.settingsName) result[setting.settingsName as JiraSettingName] = setting.settingsValue ?? undefined;
		}
		return result;
	}

	summaryOf(tenant: IIntegrationTenant): JiraConnectionSummary {
		const settings = this.settingsOf(tenant);
		return {
			id: tenant.id as ID,
			organizationId: tenant.organizationId as ID,
			cloudId: settings[JiraSettingName.JIRA_CLOUD_ID] || null,
			siteUrl: settings[JiraSettingName.JIRA_SITE_URL] || null,
			siteName: settings[JiraSettingName.JIRA_SITE_NAME] || null,
			accountId: settings[JiraSettingName.JIRA_ACCOUNT_ID] || null,
			accountName: settings[JiraSettingName.JIRA_ACCOUNT_NAME] || null,
			siteRequired: !settings[JiraSettingName.JIRA_CLOUD_ID],
			webhookExpiresAt: settings[JiraSettingName.WEBHOOK_EXPIRES_AT] || null,
			webhookError: settings[JiraSettingName.WEBHOOK_ERROR] || null,
			connectedByUserId: settings[JiraSettingName.CONNECTED_BY_USER_ID] ?? null,
			attentionReason: settings[JiraSettingName.ATTENTION_REASON] || null,
			tokenExpiresAt: settings[JiraSettingName.EXPIRES_AT] || null,
			lastSyncedAt: (tenant as { lastSyncedAt?: Date }).lastSyncedAt ?? null,
			createdAt: (tenant as { createdAt?: Date }).createdAt ?? null
		};
	}

	/**
	 * The API client of a connection's site as it is; 400 `JIRA_NOT_CONNECTED` when it holds no token, 400
	 * `JIRA_SITE_REQUIRED` while no site is chosen.
	 */
	clientFor(tenant: IIntegrationTenant): JiraApiClient {
		const settings = this.settingsOf(tenant);
		const token = settings[JiraSettingName.ACCESS_TOKEN];
		if (!token) {
			throw new BadRequestException({ message: 'The Jira connection holds no token', code: JIRA_NOT_CONNECTED });
		}
		const cloudId = settings[JiraSettingName.JIRA_CLOUD_ID];
		if (!cloudId) {
			throw new BadRequestException({ message: 'Choose the Jira site of the connection first', code: JIRA_SITE_REQUIRED });
		}
		return new JiraApiClient(token, cloudId, { apiUrl: this.config.apiUrl, tokenType: settings[JiraSettingName.TOKEN_TYPE] || 'Bearer' });
	}

	/** A client of one of the sites the connection's token reaches (the site a person is choosing). */
	clientForSite(tenant: IIntegrationTenant, cloudId: string): JiraApiClient {
		const settings = this.settingsOf(tenant);
		const token = settings[JiraSettingName.ACCESS_TOKEN];
		if (!token) throw new BadRequestException({ message: 'The Jira connection holds no token', code: JIRA_NOT_CONNECTED });
		return new JiraApiClient(token, cloudId, { apiUrl: this.config.apiUrl, tokenType: settings[JiraSettingName.TOKEN_TYPE] || 'Bearer' });
	}

	/** The connection's access token, renewed first when it is about to expire (the site list is read with it). */
	async accessTokenReady(tenant: IIntegrationTenant): Promise<string> {
		if (this.isExpiringSoon(tenant) && this.settingsOf(tenant)[JiraSettingName.REFRESH_TOKEN]) {
			await this.refreshAccessToken(tenant);
		}
		const token = this.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN];
		if (!token) throw new BadRequestException({ message: 'The Jira connection holds no token', code: JIRA_NOT_CONNECTED });
		return token;
	}

	/** The API client of a connection, its access token renewed first when it is about to expire. */
	async clientReady(tenant: IIntegrationTenant): Promise<JiraApiClient> {
		if (this.isExpiringSoon(tenant) && this.settingsOf(tenant)[JiraSettingName.REFRESH_TOKEN]) {
			const renewed = await this.refreshAccessToken(tenant);
			if (renewed) return renewed;
		}
		return this.clientFor(tenant);
	}

	/**
	 * Renews the connection's access token with its refresh token (one renewal at a time per connection; the
	 * stored pair is rotated and the in-memory settings follow). Null when the connection has no refresh token
	 * or Jira refused it — the caller then treats the token as refused.
	 *
	 * @param refused The client whose token Jira just refused (401), when that is why: the stored token is then
	 * reused only when it is another one (renewed meanwhile by another process); the same token, even far from its
	 * expiry, is renewed.
	 */
	refreshAccessToken(tenant: IIntegrationTenant, refused?: JiraApiClient | null): Promise<JiraApiClient | null> {
		const key = String(tenant.id);
		const inFlight = this.refreshing.get(key);
		if (inFlight) return inFlight;
		const renewal = this.renew(tenant, refused ?? null).finally(() => this.refreshing.delete(key));
		this.refreshing.set(key, renewal);
		return renewal;
	}

	private async renew(tenant: IIntegrationTenant, refused: JiraApiClient | null): Promise<JiraApiClient | null> {
		// The row as it is now: another process may have renewed it meanwhile (the stored refresh token is then the new
		// one; the one in memory is spent, and spending it again would be refused).
		const current = await this.findAnyById(tenant.id as ID);
		if (current) tenant.settings = current.settings;
		const stored = this.settingsOf(tenant)[JiraSettingName.ACCESS_TOKEN];
		const storedWasRefused = !!refused && refused.usesToken(stored);
		if (current && !this.isExpiringSoon(current) && !storedWasRefused) return this.clientOrNull(tenant);
		const settings = this.settingsOf(tenant);
		const refreshToken = settings[JiraSettingName.REFRESH_TOKEN];
		if (!refreshToken || !this.config.clientId || !this.config.clientSecret) return null;
		try {
			const token = await refreshJiraToken(this.config.tokenUrl, {
				refreshToken,
				clientId: this.config.clientId,
				clientSecret: this.config.clientSecret
			});
			// Another process may have renewed the connection while this exchange ran (Atlassian accepts a refresh token
			// again within its reuse interval): its pair, stored first, is kept, and this one is dropped rather than
			// written over a newer one.
			const latest = await this.findAnyById(tenant.id as ID);
			if (latest && this.settingsOf(latest)[JiraSettingName.REFRESH_TOKEN] !== refreshToken) {
				tenant.settings = latest.settings;
				// The stored pair may be half written yet (its refresh token goes first): this call goes on with the access
				// token its own exchange minted, which Atlassian issued and which is valid, and stores nothing.
				const cloudId = this.settingsOf(tenant)[JiraSettingName.JIRA_CLOUD_ID];
				return cloudId ? new JiraApiClient(token.accessToken, cloudId, { apiUrl: this.config.apiUrl, tokenType: token.tokenType || 'Bearer' }) : null;
			}
			await this.writeToken(tenant, token);
			return this.clientOrNull(tenant);
		} catch (error) {
			this.logger.warn(`The Jira token of connection ${tenant.id} could not be renewed: ${(error as Error).message}`);
			return null;
		}
	}

	/** The client of the connection's site, or null while no site is chosen (the token alone is renewed then). */
	private clientOrNull(tenant: IIntegrationTenant): JiraApiClient | null {
		return this.settingsOf(tenant)[JiraSettingName.JIRA_CLOUD_ID] ? this.clientFor(tenant) : null;
	}

	/** Whether the access token expires within the refresh window (an unknown expiry never does). */
	isExpiringSoon(tenant: IIntegrationTenant, now = Date.now()): boolean {
		const expiresAt = this.settingsOf(tenant)[JiraSettingName.EXPIRES_AT];
		if (!expiresAt) return false;
		const at = Date.parse(expiresAt);
		return Number.isFinite(at) && at - now <= JIRA_TOKEN_REFRESH_AHEAD_MS;
	}

	/**
	 * Records (or renews) the connection of an organization with a fresh token. With one Jira site the token reaches,
	 * the site is chosen at once (`site` and the account it opens); with several, the connection waits for a person to
	 * choose one ({@link selectSite}) and nothing syncs until then.
	 */
	async connect(
		scope: { tenantId: ID; organizationId: ID; userId?: ID | null },
		token: JiraOAuthToken,
		site: { site: JiraSite; myself: JiraMyself } | null
	): Promise<IIntegrationTenant> {
		const { tenantId, organizationId } = scope;
		// The connection this one replaces, if any: a refusal it carried is over once the new token is stored.
		const replaced = await this.forOrganization(organizationId, tenantId);
		const wasRefused = !!(replaced && this.settingsOf(replaced)[JiraSettingName.ATTENTION_REASON]);
		const previousUserId = (replaced && this.settingsOf(replaced)[JiraSettingName.CONNECTED_BY_USER_ID]) || null;
		// A reconnect to the same site keeps the webhook it had (the sweep refreshes it); another site starts without one.
		const previous: JiraSettings = replaced ? this.settingsOf(replaced) : {};
		const sameSite = !!site && previous[JiraSettingName.JIRA_CLOUD_ID] === site.site.id;
		const integration = await this.integrationTenantService['typeOrmRepository'].manager.findOne(Integration, {
			where: { name: JIRA_INTEGRATION_NAME }
		});
		if (!integration) {
			throw new NotFoundException({ message: 'The Jira integration is not in the catalogue', code: JIRA_NOT_CONNECTED });
		}
		const settings = [
			[JiraSettingName.ACCESS_TOKEN, token.accessToken],
			[JiraSettingName.REFRESH_TOKEN, token.refreshToken ?? ''],
			[JiraSettingName.TOKEN_TYPE, token.tokenType],
			[JiraSettingName.EXPIRES_AT, this.expiresAtOf(token)],
			[JiraSettingName.SCOPE, token.scope ?? ''],
			[JiraSettingName.JIRA_CLOUD_ID, site?.site.id ?? ''],
			[JiraSettingName.JIRA_SITE_URL, site?.site.url ?? ''],
			[JiraSettingName.JIRA_SITE_NAME, site?.site.name ?? ''],
			[JiraSettingName.JIRA_ACCOUNT_ID, site?.myself.accountId ?? ''],
			[JiraSettingName.JIRA_ACCOUNT_NAME, site?.myself.displayName ?? ''],
			[JiraSettingName.CONNECTED_BY_USER_ID, scope.userId ? String(scope.userId) : ''],
			[JiraSettingName.ATTENTION_REASON, ''],
			[JiraSettingName.WEBHOOK_IDS, sameSite ? previous[JiraSettingName.WEBHOOK_IDS] ?? '' : ''],
			[JiraSettingName.WEBHOOK_JQL, sameSite ? previous[JiraSettingName.WEBHOOK_JQL] ?? '' : ''],
			[JiraSettingName.WEBHOOK_EXPIRES_AT, sameSite ? previous[JiraSettingName.WEBHOOK_EXPIRES_AT] ?? '' : ''],
			[JiraSettingName.WEBHOOK_URL, sameSite ? previous[JiraSettingName.WEBHOOK_URL] ?? '' : ''],
			[JiraSettingName.WEBHOOK_ERROR, '']
		].map(([settingsName, settingsValue]) => ({ settingsName, settingsValue, tenantId, organizationId }));
		const entitySettings = [IntegrationEntity.PROJECT, IntegrationEntity.ISSUE, IntegrationEntity.LABEL].map((entity) => ({
			entity,
			sync: true,
			tenantId,
			organizationId
		}));
		const written: IIntegrationTenant = await this.commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{ name: JIRA_INTEGRATION_NAME, integration: { provider: JIRA_INTEGRATION_NAME }, tenantId, organizationId },
				{
					name: JIRA_INTEGRATION_NAME,
					integration,
					tenantId,
					organizationId,
					entitySettings,
					settings,
					isActive: true,
					isArchived: false
				} as never
			)
		);
		// The platform's settings writer reports a failed write instead of raising it, and answers the row without its
		// settings: the connection is read back — the token checked, and the notice of the connection it replaces resolved.
		const stored = await this.findAnyById(written.id as ID);
		const kept = stored ? this.settingsOf(stored) : null;
		// Every setting the connection cannot work without: the token pair, and the site when one was chosen.
		if (
			!stored ||
			!kept ||
			kept[JiraSettingName.ACCESS_TOKEN] !== token.accessToken ||
			(kept[JiraSettingName.REFRESH_TOKEN] ?? '') !== (token.refreshToken ?? '') ||
			(kept[JiraSettingName.JIRA_CLOUD_ID] ?? '') !== (site?.site.id ?? '')
		) {
			throw new InternalServerErrorException({ message: 'The Jira connection could not be stored; connect again', code: JIRA_NOT_CONNECTED });
		}
		// The notice went to whoever connected before: they hear of the resolution too, whoever reconnected.
		if (wasRefused) await this.fileAttention(stored, null, previousUserId ? [previousUserId as ID] : []);
		return stored;
	}

	/**
	 * Records why the connection needs a person (a refused token), or clears it — and tells the person who connected
	 * and the organization's integration managers in their Inbox, once per refusal (the item is keyed by the
	 * connection) and once more when it works again.
	 */
	async setAttention(tenant: IIntegrationTenant, reason: string | null, refusedToken?: string | null): Promise<void> {
		// A refusal names the token it was for: when the row holds another one by now (reconnected meanwhile), the
		// refusal is stale and the connection is left alone; a real refusal of the new token marks it on its next use.
		if (reason && refusedToken) {
			const current = await this.findAnyById(tenant.id as ID);
			const stored = current ? this.settingsOf(current)[JiraSettingName.ACCESS_TOKEN] : null;
			if (current && stored && stored !== refusedToken) {
				this.logger.log(`Connection ${tenant.id}: the refused token is not the stored one any more; not marked.`);
				return;
			}
		}
		const settings = this.settingsOf(tenant);
		const before = settings[JiraSettingName.ATTENTION_REASON] || null;
		const noticed = !!settings[JiraSettingName.ATTENTION_NOTICE_AT] && settings[JiraSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED;
		try {
			await this.writeSetting(tenant, JiraSettingName.ATTENTION_REASON, reason ?? '');
		} catch (error) {
			// Not filed either: the Inbox must not say the imports are paused while the sweep still runs them.
			this.logger.warn(`The attention reason of connection ${tenant.id} could not be written: ${(error as Error).message}`);
			return;
		}
		// A reconnect may have stored another token between the check above and this write (it clears the reason, and
		// this write would set it back on the new connection): read again, and undo the mark when it is so.
		if (reason && refusedToken) {
			const after = await this.findAnyById(tenant.id as ID);
			const storedNow = after ? this.settingsOf(after)[JiraSettingName.ACCESS_TOKEN] : null;
			if (after && storedNow && storedNow !== refusedToken) {
				this.logger.log(`Connection ${tenant.id}: reconnected while its refusal was being marked; the mark is undone.`);
				tenant.settings = after.settings;
				await this.writeSetting(tenant, JiraSettingName.ATTENTION_REASON, '').catch((error: unknown) => {
					this.logger.warn(`The attention reason of connection ${tenant.id} could not be cleared: ${(error as Error).message}`);
				});
				return;
			}
		}
		// A new refusal is not filed until its own filing records it: the timestamp an earlier refusal left (a resolution
		// whose filing failed) is cleared first, so every way the filing below can stop leaves it to the sweep.
		if (reason && before !== reason && settings[JiraSettingName.ATTENTION_NOTICE_AT]) {
			try {
				await this.writeSetting(tenant, JiraSettingName.ATTENTION_NOTICE_AT, '');
			} catch (error) {
				this.logger.warn(`The filing timestamp of connection ${tenant.id} could not be cleared: ${(error as Error).message}`);
			}
		}
		// Filed when the reason changed — and again when an earlier filing (or resolution) did not get through: the
		// item is keyed by the connection, so a second filing updates it rather than adding one.
		const changed = reason ? before !== reason : !!before;
		const pending = reason ? !noticed : noticed;
		if (changed || pending) await this.fileAttention(tenant, reason);
	}

	/**
	 * Files the notice of a refused connection whose filing did not get through (no `ATTENTION_NOTICE_AT`): the
	 * scheduled sweep calls it for every refused connection it leaves alone, so the retry is durable — every five
	 * minutes until the Inbox took it — and does not wait for the next refusal.
	 */
	async ensureAttentionFiled(tenant: IIntegrationTenant): Promise<void> {
		const settings = this.settingsOf(tenant);
		const reason = settings[JiraSettingName.ATTENTION_REASON] || null;
		const noticeAt = settings[JiraSettingName.ATTENTION_NOTICE_AT] || '';
		if (!reason || (noticeAt && noticeAt !== ATTENTION_NOTICE_DEFERRED)) return;
		// A deferred notice was never filed: its first filing re-surfaces it; a retry of a filing taken does not.
		await this.fileAttention(tenant, reason, [], noticeAt === ATTENTION_NOTICE_DEFERRED);
	}

	/** The connections of this integration that wait for a person and whose notice did not get through yet: the sweep files those again. */
	async findRefusedUnfiled(): Promise<IIntegrationTenant[]> {
		const rows = (await this.integrationTenantService['typeOrmRepository']
			.find({ where: { name: JIRA_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch((error: unknown) => {
				this.logger.warn(`The refused connections could not be listed: ${(error as Error)?.message ?? error}`);
				return [];
			})) as IIntegrationTenant[];
		return rows.filter((row) => {
			const settings = this.settingsOf(row);
			return !!settings[JiraSettingName.ATTENTION_REASON] && (!settings[JiraSettingName.ATTENTION_NOTICE_AT] || settings[JiraSettingName.ATTENTION_NOTICE_AT] === ATTENTION_NOTICE_DEFERRED);
		});
	}

	/**
	 * Files (or resolves) the Inbox item about the connection and remembers that it got through; nothing without
	 * the Inbox plugin, or with nobody to tell. The item goes to the person who connected and to the organization's
	 * integration managers (the people whose role may add or edit integrations: they can connect again); a manager
	 * list that cannot be read leaves the person who connected, and the next filing reads it again. A filing that failed is tried again by the next {@link setAttention}
	 * and by the sweep ({@link ensureAttentionFiled}). The two writes are separate: an item that was taken but whose
	 * timestamp was not written is logged as such, and a retry re-files it without re-surfacing it.
	 */
	private async fileAttention(tenant: IIntegrationTenant, reason: string | null, alsoUserIds: readonly ID[] = [], resurface = true): Promise<void> {
		if (!this.inbox) return;
		// The row as it is now: a filing from before a reconnect or a newer refusal is stale and files nothing.
		const current = await this.findAnyById(tenant.id as ID);
		if (!current) return;
		const settings = this.settingsOf(current);
		if ((settings[JiraSettingName.ATTENTION_REASON] || null) !== (reason || null)) return;
		const userId = settings[JiraSettingName.CONNECTED_BY_USER_ID];
		let managers: ID[] | null = null;
		let truncated = false;
		try {
			const found = await this.integrationTenantService.findManagers({ tenantId: current.tenantId as ID, organizationId: current.organizationId as ID });
			managers = found.userIds;
			truncated = found.truncated;
		} catch (error) {
			this.logger.warn(`The integration managers of connection ${tenant.id} could not be read: ${(error as Error)?.message ?? error}`);
		}
		// The lookup stops at INTEGRATION_MANAGERS_LIMIT memberships: when it left managers out, the notice replaces nobody either.
		if (truncated) {
			this.logger.warn(`Connection ${tenant.id}: the organization has more than ${INTEGRATION_MANAGERS_LIMIT} integration manager memberships; the notice goes to the first ones and removes nobody`);
		}
		// Without the managers an open notice is not filed at all: a partial list could neither drop a former connector
		// from the shared item nor keep a current manager on it. Nothing is recorded, so the sweep files it with them
		// (a new refusal starts with no filing timestamp: see setAttention).
		if (reason && managers === null) {
			// Marked deferred, so the sweep's filing re-surfaces it for the recipients it reaches (it is a new refusal to them).
			if (settings[JiraSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED) {
				await this.writeSetting(tenant, JiraSettingName.ATTENTION_NOTICE_AT, ATTENTION_NOTICE_DEFERRED).catch((error: unknown) => {
					this.logger.warn(`The deferred notice of connection ${tenant.id} could not be marked: ${(error as Error)?.message ?? error}`);
				});
			}
			return;
		}
		const partial = !!reason && truncated;
		const recipients = [...new Set([userId, ...(managers ?? []), ...alsoUserIds].filter(Boolean).map(String))] as ID[];
		if (!recipients.length) return;
		try {
			await this.inbox.upsertExternal(attentionItemOf({ id: tenant.id as ID, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID }, reason, recipients, resurface, partial));
		} catch (error) {
			this.logger.warn(`The attention of connection ${tenant.id} could not be filed in the Inbox: ${(error as Error).message}`);
			// An open notice the Inbox did not take has not reached anyone yet: marked deferred, so the sweep's filing
			// re-surfaces it (a retry of a filing the Inbox did take is not marked, and does not re-surface).
			if (reason && resurface && settings[JiraSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED) {
				await this.writeSetting(tenant, JiraSettingName.ATTENTION_NOTICE_AT, ATTENTION_NOTICE_DEFERRED).catch(() => undefined);
			}
			return;
		}
		try {
			await this.writeSetting(tenant, JiraSettingName.ATTENTION_NOTICE_AT, reason ? new Date().toISOString() : '');
		} catch (error) {
			this.logger.warn(`The attention of connection ${tenant.id} was filed, but that could not be recorded (it will be filed again, without re-surfacing): ${(error as Error).message}`);
		}
	}

	/**
	 * Chooses the Jira site of a connection whose token reaches several (or moves it to another): the site and the
	 * account the token opens on it are stored, and the webhook of the former site is forgotten (the caller removes it
	 * from Jira first). The mappings stay: a mapping names a project of the site it was made on, and one that the new
	 * site does not have imports nothing.
	 */
	async selectSite(tenant: IIntegrationTenant, site: JiraSite, myself: JiraMyself): Promise<IIntegrationTenant> {
		const moved = this.settingsOf(tenant)[JiraSettingName.JIRA_CLOUD_ID] !== site.id;
		await this.writeSetting(tenant, JiraSettingName.JIRA_CLOUD_ID, site.id);
		await this.writeSetting(tenant, JiraSettingName.JIRA_SITE_URL, site.url);
		await this.writeSetting(tenant, JiraSettingName.JIRA_SITE_NAME, site.name);
		await this.writeSetting(tenant, JiraSettingName.JIRA_ACCOUNT_ID, myself.accountId);
		await this.writeSetting(tenant, JiraSettingName.JIRA_ACCOUNT_NAME, myself.displayName ?? '');
		if (moved) await this.recordWebhook(tenant, { ids: [], jql: '', expiresAt: null, error: null });
		return tenant;
	}

	/** The webhook ids of a connection (registered on its site), each once. */
	webhookIdsOf(tenant: IIntegrationTenant): string[] {
		const raw = this.settingsOf(tenant)[JiraSettingName.WEBHOOK_IDS] ?? '';
		return [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => /^\d{1,20}$/.test(id)))];
	}

	/** Records the connection's webhook as Jira has it now (or its absence), and why the last registration failed. */
	async recordWebhook(tenant: IIntegrationTenant, webhook: { ids: readonly string[]; jql: string; url?: string | null; expiresAt: string | null; error: string | null }): Promise<void> {
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_IDS, webhook.ids.join(','));
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_JQL, webhook.jql);
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_URL, webhook.url ?? '');
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_EXPIRES_AT, webhook.expiresAt ?? '');
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_ERROR, (webhook.error ?? '').slice(0, 500));
	}

	/** Records only why the webhook's registration or refresh failed (the webhook itself is left as it is). */
	async recordWebhookError(tenant: IIntegrationTenant, error: string | null): Promise<void> {
		await this.writeSetting(tenant, JiraSettingName.WEBHOOK_ERROR, (error ?? '').slice(0, 500));
	}

	/** Every live connection of the integration, across tenants, with its settings: the sweep renews their webhooks. */
	async findAllConnected(): Promise<IIntegrationTenant[]> {
		return ((await this.integrationTenantService['typeOrmRepository']
			.find({ where: { name: JIRA_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch((error: unknown) => {
				this.logger.warn(`The Jira connections could not be listed: ${(error as Error)?.message ?? error}`);
				return [];
			})) ?? []) as IIntegrationTenant[];
	}

	/** Removes the connection; its mappings and runs go with it (foreign keys). */
	async disconnect(tenant: IIntegrationTenant): Promise<void> {
		await this.integrationTenantService.delete(tenant.id as ID);
	}

	/**
	 * Stores a renewed pair. The rotated refresh token is written first: a stop between the two writes then leaves the
	 * new refresh token with the former access token (renewed again on its next use), never the spent refresh token with
	 * the new access token (which could not be renewed once Atlassian's reuse interval is over).
	 */
	private async writeToken(tenant: IIntegrationTenant, token: JiraOAuthToken): Promise<void> {
		if (token.refreshToken) await this.writeSetting(tenant, JiraSettingName.REFRESH_TOKEN, token.refreshToken);
		await this.writeSetting(tenant, JiraSettingName.ACCESS_TOKEN, token.accessToken);
		await this.writeSetting(tenant, JiraSettingName.TOKEN_TYPE, token.tokenType);
		await this.writeSetting(tenant, JiraSettingName.EXPIRES_AT, this.expiresAtOf(token));
		await this.setAttention(tenant, null);
	}

	/** Writes one setting row of the connection (updated when it exists, created otherwise) and mirrors it in memory. */
	private async writeSetting(tenant: IIntegrationTenant, name: JiraSettingName, value: string): Promise<void> {
		const settings = (tenant.settings ?? []) as IIntegrationSetting[];
		const existing = settings.find((setting) => setting.settingsName === name);
		if (existing?.id) {
			await this.integrationSettingService.update(existing.id, { settingsValue: value } as never);
			existing.settingsValue = value;
			return;
		}
		const created: IIntegrationSetting = await this.integrationSettingService.create({
			settingsName: name,
			settingsValue: value,
			integration: { id: tenant.id },
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId
		} as never);
		tenant.settings = [...settings, created];
	}

	private expiresAtOf(token: JiraOAuthToken): string {
		return token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : '';
	}
}
