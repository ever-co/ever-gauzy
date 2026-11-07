import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ID, IIntegrationSetting, IIntegrationTenant, IntegrationEntity } from '@gauzy/contracts';
import { Integration, IntegrationSettingService, IntegrationTenantService, IntegrationTenantUpdateOrCreateCommand, RequestContext } from '@gauzy/core';
import { AsanaApiClient, AsanaOAuthToken, refreshAsanaToken } from './client/asana-api.client';
import { AsanaConfig } from './asana-config';
import { ASANA_CONFIG, ASANA_INTEGRATION_NAME, ASANA_NOT_CONNECTED, ASANA_OAUTH_TOKEN_URL, ASANA_TOKEN_REFRESH_AHEAD_MS, AsanaSettingName } from './asana.constants';

/** The settings of a connection as a map (`settingsName` → `settingsValue`). */
export type AsanaSettings = Partial<Record<AsanaSettingName, string>>;

/** What the routes answer about a connection (never a token). */
export interface AsanaConnectionSummary {
	id: ID;
	organizationId: ID;
	asanaUserGid: string | null;
	asanaUserName: string | null;
	asanaUserEmail: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	tokenExpiresAt: string | null;
	lastSyncedAt: Date | null;
	createdAt: Date | null;
}

/**
 * The connected organizations: each is an `integration_tenant` named `Asana` whose settings hold the OAuth
 * tokens and the Asana user they belong to. The tokens are written only here and read only by
 * {@link clientFor} / {@link clientReady}; no route answers them. Asana's access tokens last an hour: one near
 * its expiry is renewed with the refresh token before use, one renewal at a time per connection.
 */
@Injectable()
export class AsanaTenantService {
	private readonly logger = new Logger(AsanaTenantService.name);
	/** The renewal in flight of each connection. */
	private readonly refreshing = new Map<string, Promise<AsanaApiClient | null>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		@Inject(ASANA_CONFIG) private readonly config: AsanaConfig
	) {}

	/** The connection of an organization in the current tenant, with its settings, or null. */
	async forOrganization(organizationId: ID, tenantId: ID = RequestContext.currentTenantId() as ID): Promise<IIntegrationTenant | null> {
		if (!tenantId || !organizationId) return null;
		return this.integrationTenantService
			.findOneByOptions({
				where: { name: ASANA_INTEGRATION_NAME, tenantId, organizationId, isActive: true, isArchived: false },
				relations: { settings: true },
				order: { createdAt: 'DESC' }
			})
			.catch(() => null);
	}

	/** A connection by id, in the current tenant, with its settings; 404 otherwise. */
	async requireById(integrationId: ID): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const tenant = await this.integrationTenantService
			.findOneByIdString(integrationId, {
				where: { name: ASANA_INTEGRATION_NAME, tenantId: tenantId as ID, isActive: true, isArchived: false },
				relations: { settings: true }
			})
			.catch(() => null);
		if (!tenant) {
			throw new NotFoundException({ message: 'The Asana connection was not found', code: ASANA_NOT_CONNECTED });
		}
		return tenant;
	}

	/** A connection by id regardless of the request (a webhook has no tenant): with its settings, or null. */
	async findAnyById(integrationId: ID): Promise<IIntegrationTenant | null> {
		return this.integrationTenantService['typeOrmRepository']
			.findOne({ where: { id: integrationId, name: ASANA_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch(() => null) as Promise<IIntegrationTenant | null>;
	}

	settingsOf(tenant: IIntegrationTenant): AsanaSettings {
		const result: AsanaSettings = {};
		for (const setting of tenant.settings ?? []) {
			if (setting.settingsName) result[setting.settingsName as AsanaSettingName] = setting.settingsValue ?? undefined;
		}
		return result;
	}

	summaryOf(tenant: IIntegrationTenant): AsanaConnectionSummary {
		const settings = this.settingsOf(tenant);
		return {
			id: tenant.id as ID,
			organizationId: tenant.organizationId as ID,
			asanaUserGid: settings[AsanaSettingName.ASANA_USER_GID] ?? null,
			asanaUserName: settings[AsanaSettingName.ASANA_USER_NAME] ?? null,
			asanaUserEmail: settings[AsanaSettingName.ASANA_USER_EMAIL] ?? null,
			connectedByUserId: settings[AsanaSettingName.CONNECTED_BY_USER_ID] ?? null,
			attentionReason: settings[AsanaSettingName.ATTENTION_REASON] || null,
			tokenExpiresAt: settings[AsanaSettingName.EXPIRES_AT] || null,
			lastSyncedAt: (tenant as { lastSyncedAt?: Date }).lastSyncedAt ?? null,
			createdAt: (tenant as { createdAt?: Date }).createdAt ?? null
		};
	}

	/** The API client of a connection as it is; 400 `ASANA_NOT_CONNECTED` when it holds no token. */
	clientFor(tenant: IIntegrationTenant): AsanaApiClient {
		const token = this.settingsOf(tenant)[AsanaSettingName.ACCESS_TOKEN];
		if (!token) {
			throw new BadRequestException({ message: 'The Asana connection holds no token', code: ASANA_NOT_CONNECTED });
		}
		return new AsanaApiClient(token, { apiUrl: this.config.apiUrl });
	}

	/** The API client of a connection, its access token renewed first when it is about to expire. */
	async clientReady(tenant: IIntegrationTenant): Promise<AsanaApiClient> {
		if (this.isExpiringSoon(tenant) && this.settingsOf(tenant)[AsanaSettingName.REFRESH_TOKEN]) {
			const renewed = await this.refreshAccessToken(tenant);
			if (renewed) return renewed;
		}
		return this.clientFor(tenant);
	}

	/** Renews the access token with the refresh token (one renewal at a time per connection); null when it cannot. */
	refreshAccessToken(tenant: IIntegrationTenant): Promise<AsanaApiClient | null> {
		const key = String(tenant.id);
		const inFlight = this.refreshing.get(key);
		if (inFlight) return inFlight;
		const renewal = this.renew(tenant).finally(() => this.refreshing.delete(key));
		this.refreshing.set(key, renewal);
		return renewal;
	}

	private async renew(tenant: IIntegrationTenant): Promise<AsanaApiClient | null> {
		const refreshToken = this.settingsOf(tenant)[AsanaSettingName.REFRESH_TOKEN];
		if (!refreshToken || !this.config.clientId || !this.config.clientSecret) return null;
		try {
			const token = await refreshAsanaToken(ASANA_OAUTH_TOKEN_URL, { refreshToken, clientId: this.config.clientId, clientSecret: this.config.clientSecret });
			await this.writeToken(tenant, token);
			return this.clientFor(tenant);
		} catch (error) {
			this.logger.warn(`The Asana token of connection ${tenant.id} could not be renewed: ${(error as Error).message}`);
			return null;
		}
	}

	/** Whether the access token expires within the refresh window (an unknown expiry never does). */
	isExpiringSoon(tenant: IIntegrationTenant, now = Date.now()): boolean {
		const expiresAt = this.settingsOf(tenant)[AsanaSettingName.EXPIRES_AT];
		if (!expiresAt) return false;
		const at = Date.parse(expiresAt);
		return Number.isFinite(at) && at - now <= ASANA_TOKEN_REFRESH_AHEAD_MS;
	}

	/** Records (or renews) the connection of an organization with a fresh token and the Asana user it belongs to. */
	async connect(
		scope: { tenantId: ID; organizationId: ID; userId?: ID | null },
		token: AsanaOAuthToken,
		user: { gid: string; name: string; email: string | null }
	): Promise<IIntegrationTenant> {
		const { tenantId, organizationId } = scope;
		const integration = await this.integrationTenantService['typeOrmRepository'].manager.findOne(Integration, { where: { name: ASANA_INTEGRATION_NAME } });
		if (!integration) {
			throw new NotFoundException({ message: 'The Asana integration is not in the catalogue', code: ASANA_NOT_CONNECTED });
		}
		const settings = [
			[AsanaSettingName.ACCESS_TOKEN, token.accessToken],
			[AsanaSettingName.REFRESH_TOKEN, token.refreshToken ?? ''],
			[AsanaSettingName.TOKEN_TYPE, token.tokenType],
			[AsanaSettingName.EXPIRES_AT, this.expiresAtOf(token)],
			[AsanaSettingName.ASANA_USER_GID, user.gid],
			[AsanaSettingName.ASANA_USER_NAME, user.name],
			[AsanaSettingName.ASANA_USER_EMAIL, user.email ?? ''],
			[AsanaSettingName.CONNECTED_BY_USER_ID, scope.userId ? String(scope.userId) : ''],
			[AsanaSettingName.ATTENTION_REASON, '']
		].map(([settingsName, settingsValue]) => ({ settingsName, settingsValue, tenantId, organizationId }));
		const entitySettings = [IntegrationEntity.PROJECT, IntegrationEntity.TASK, IntegrationEntity.LABEL].map((entity) => ({ entity, sync: true, tenantId, organizationId }));
		const written: IIntegrationTenant = await this.commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{ name: ASANA_INTEGRATION_NAME, integration: { provider: ASANA_INTEGRATION_NAME }, tenantId, organizationId },
				{ name: ASANA_INTEGRATION_NAME, integration, tenantId, organizationId, entitySettings, settings, isActive: true, isArchived: false } as never
			)
		);
		// The platform's settings writer reports a failed write instead of raising it: the token is read back, and a
		// connection whose token is not the one just granted is not answered as connected.
		const stored = await this.findAnyById(written.id as ID);
		if (!stored || this.settingsOf(stored)[AsanaSettingName.ACCESS_TOKEN] !== token.accessToken) {
			throw new InternalServerErrorException({ message: 'The Asana connection could not be stored; connect again', code: ASANA_NOT_CONNECTED });
		}
		return stored;
	}

	/** Records why the connection needs a person (a refused token), or clears it. */
	async setAttention(tenant: IIntegrationTenant, reason: string | null): Promise<void> {
		try {
			await this.writeSetting(tenant, AsanaSettingName.ATTENTION_REASON, reason ?? '');
		} catch (error) {
			this.logger.warn(`The attention reason of connection ${tenant.id} could not be written: ${(error as Error).message}`);
		}
	}

	/** Removes the connection; its mappings and runs go with it (foreign keys). */
	async disconnect(tenant: IIntegrationTenant): Promise<void> {
		await this.integrationTenantService.delete(tenant.id as ID);
	}

	/** Stores a renewed token (the refresh token only when Asana sent a new one) and clears the attention. */
	private async writeToken(tenant: IIntegrationTenant, token: AsanaOAuthToken): Promise<void> {
		await this.writeSetting(tenant, AsanaSettingName.ACCESS_TOKEN, token.accessToken);
		if (token.refreshToken) await this.writeSetting(tenant, AsanaSettingName.REFRESH_TOKEN, token.refreshToken);
		await this.writeSetting(tenant, AsanaSettingName.TOKEN_TYPE, token.tokenType);
		await this.writeSetting(tenant, AsanaSettingName.EXPIRES_AT, this.expiresAtOf(token));
		await this.writeSetting(tenant, AsanaSettingName.ATTENTION_REASON, '');
	}

	/** Writes one setting row of the connection (updated when it exists, created otherwise) and mirrors it in memory. */
	private async writeSetting(tenant: IIntegrationTenant, name: AsanaSettingName, value: string): Promise<void> {
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

	private expiresAtOf(token: AsanaOAuthToken): string {
		return token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : '';
	}
}
