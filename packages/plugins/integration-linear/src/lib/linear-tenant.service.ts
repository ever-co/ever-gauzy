import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ID, IIntegrationSetting, IIntegrationTenant, IntegrationEntity } from '@gauzy/contracts';
import {
	Integration,
	IntegrationSettingGetManyCommand,
	IntegrationSettingService,
	IntegrationTenantService,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext
} from '@gauzy/core';
import { LinearApiClient, LinearOAuthToken, LinearViewer, refreshLinearToken } from './client/linear-api.client';
import { LinearConfig } from './linear-config';
import {
	LINEAR_CONFIG,
	LINEAR_INTEGRATION_NAME,
	LINEAR_NOT_CONNECTED,
	LINEAR_OAUTH_TOKEN_URL,
	LINEAR_TOKEN_REFRESH_AHEAD_MS,
	LinearSettingName
} from './linear.constants';

/** The settings of a connection as a map (`settingsName` → `settingsValue`). */
export type LinearSettings = Partial<Record<LinearSettingName, string>>;

/** What the routes answer about a connection (never a token). */
export interface LinearConnectionSummary {
	id: ID;
	organizationId: ID;
	linearOrganizationId: string | null;
	linearOrganizationName: string | null;
	linearOrganizationUrlKey: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	tokenExpiresAt: string | null;
	lastSyncedAt: Date | null;
	createdAt: Date | null;
}

/**
 * The connected organizations: each is an `integration_tenant` named `Linear` whose settings hold the
 * OAuth tokens and the Linear workspace they belong to. The tokens are written only here and read only by
 * {@link clientFor} / {@link clientReady}; no route answers them. An access token near its expiry is
 * renewed with the refresh token before use, one renewal at a time per connection, and the pair is rotated.
 */
@Injectable()
export class LinearTenantService {
	private readonly logger = new Logger(LinearTenantService.name);
	/** The renewal in flight of each connection, so two callers never spend the same refresh token. */
	private readonly refreshing = new Map<string, Promise<LinearApiClient | null>>();

	constructor(
		private readonly commandBus: CommandBus,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig
	) {}

	/** The connection of an organization in the current tenant, with its settings, or null. */
	async forOrganization(organizationId: ID, tenantId: ID = RequestContext.currentTenantId() as ID): Promise<IIntegrationTenant | null> {
		if (!tenantId || !organizationId) return null;
		return this.integrationTenantService
			.findOneByOptions({
				where: { name: LINEAR_INTEGRATION_NAME, tenantId, organizationId, isActive: true, isArchived: false },
				relations: { settings: true },
				order: { createdAt: 'DESC' }
			})
			.catch(() => null);
	}

	/** A connection by id with its settings, in whatever tenant, or null: for work with no request context (a sweep). */
	async findAnyById(integrationId: ID): Promise<IIntegrationTenant | null> {
		return this.integrationTenantService['typeOrmRepository']
			.findOne({ where: { id: integrationId, name: LINEAR_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch(() => null) as Promise<IIntegrationTenant | null>;
	}

	/** A connection by id, in the current tenant, with its settings; 404 otherwise. */
	async requireById(integrationId: ID): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const tenant = await this.integrationTenantService
			.findOneByIdString(integrationId, {
				where: { name: LINEAR_INTEGRATION_NAME, tenantId: tenantId as ID, isActive: true, isArchived: false },
				relations: { settings: true }
			})
			.catch(() => null);
		if (!tenant) {
			throw new NotFoundException({ message: 'The Linear connection was not found', code: LINEAR_NOT_CONNECTED });
		}
		return tenant;
	}

	/** Every connection of a Linear workspace, across tenants (a webhook names the workspace, not the tenant). */
	async findByLinearOrganization(linearOrganizationId: string): Promise<IIntegrationTenant[]> {
		if (!linearOrganizationId) return [];
		const settings: IIntegrationSetting[] = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: {
					settingsName: LinearSettingName.LINEAR_ORGANIZATION_ID,
					settingsValue: linearOrganizationId,
					isActive: true,
					integration: { name: LINEAR_INTEGRATION_NAME, isActive: true, isArchived: false }
				},
				relations: { integration: { settings: true } }
			})
		);
		const tenants = new Map<string, IIntegrationTenant>();
		for (const setting of settings ?? []) {
			const tenant = setting.integration as IIntegrationTenant | undefined;
			if (tenant?.id) tenants.set(String(tenant.id), tenant);
		}
		return [...tenants.values()];
	}

	settingsOf(tenant: IIntegrationTenant): LinearSettings {
		const result: LinearSettings = {};
		for (const setting of tenant.settings ?? []) {
			if (setting.settingsName) result[setting.settingsName as LinearSettingName] = setting.settingsValue ?? undefined;
		}
		return result;
	}

	summaryOf(tenant: IIntegrationTenant): LinearConnectionSummary {
		const settings = this.settingsOf(tenant);
		return {
			id: tenant.id as ID,
			organizationId: tenant.organizationId as ID,
			linearOrganizationId: settings[LinearSettingName.LINEAR_ORGANIZATION_ID] ?? null,
			linearOrganizationName: settings[LinearSettingName.LINEAR_ORGANIZATION_NAME] ?? null,
			linearOrganizationUrlKey: settings[LinearSettingName.LINEAR_ORGANIZATION_URL_KEY] ?? null,
			connectedByUserId: settings[LinearSettingName.CONNECTED_BY_USER_ID] ?? null,
			attentionReason: settings[LinearSettingName.ATTENTION_REASON] || null,
			tokenExpiresAt: settings[LinearSettingName.EXPIRES_AT] || null,
			lastSyncedAt: (tenant as { lastSyncedAt?: Date }).lastSyncedAt ?? null,
			createdAt: (tenant as { createdAt?: Date }).createdAt ?? null
		};
	}

	/** The API client of a connection as it is; 400 `LINEAR_NOT_CONNECTED` when it holds no token. */
	clientFor(tenant: IIntegrationTenant): LinearApiClient {
		const settings = this.settingsOf(tenant);
		const token = settings[LinearSettingName.ACCESS_TOKEN];
		if (!token) {
			throw new BadRequestException({ message: 'The Linear connection holds no token', code: LINEAR_NOT_CONNECTED });
		}
		return new LinearApiClient(token, { apiUrl: this.config.apiUrl, tokenType: settings[LinearSettingName.TOKEN_TYPE] || 'Bearer' });
	}

	/** The API client of a connection, its access token renewed first when it is about to expire. */
	async clientReady(tenant: IIntegrationTenant): Promise<LinearApiClient> {
		if (this.isExpiringSoon(tenant) && this.settingsOf(tenant)[LinearSettingName.REFRESH_TOKEN]) {
			const renewed = await this.refreshAccessToken(tenant);
			if (renewed) return renewed;
		}
		return this.clientFor(tenant);
	}

	/**
	 * Renews the connection's access token with its refresh token (one renewal at a time per connection; the
	 * stored pair is rotated and the in-memory settings follow). Null when the connection has no refresh token
	 * or Linear refused it — the caller then treats the token as refused.
	 */
	refreshAccessToken(tenant: IIntegrationTenant): Promise<LinearApiClient | null> {
		const key = String(tenant.id);
		const inFlight = this.refreshing.get(key);
		if (inFlight) return inFlight;
		const renewal = this.renew(tenant).finally(() => this.refreshing.delete(key));
		this.refreshing.set(key, renewal);
		return renewal;
	}

	private async renew(tenant: IIntegrationTenant): Promise<LinearApiClient | null> {
		const settings = this.settingsOf(tenant);
		const refreshToken = settings[LinearSettingName.REFRESH_TOKEN];
		if (!refreshToken || !this.config.clientId || !this.config.clientSecret) return null;
		try {
			const token = await refreshLinearToken(LINEAR_OAUTH_TOKEN_URL, {
				refreshToken,
				clientId: this.config.clientId,
				clientSecret: this.config.clientSecret
			});
			await this.writeToken(tenant, token);
			return this.clientFor(tenant);
		} catch (error) {
			this.logger.warn(`The Linear token of connection ${tenant.id} could not be renewed: ${(error as Error).message}`);
			return null;
		}
	}

	/** Whether the access token expires within the refresh window (an unknown expiry never does). */
	isExpiringSoon(tenant: IIntegrationTenant, now = Date.now()): boolean {
		const expiresAt = this.settingsOf(tenant)[LinearSettingName.EXPIRES_AT];
		if (!expiresAt) return false;
		const at = Date.parse(expiresAt);
		return Number.isFinite(at) && at - now <= LINEAR_TOKEN_REFRESH_AHEAD_MS;
	}

	/** Records (or renews) the connection of an organization with a fresh token and the workspace it opens. */
	async connect(
		scope: { tenantId: ID; organizationId: ID; userId?: ID | null },
		token: LinearOAuthToken,
		viewer: LinearViewer
	): Promise<IIntegrationTenant> {
		const { tenantId, organizationId } = scope;
		const integration = await this.integrationTenantService['typeOrmRepository'].manager.findOne(Integration, {
			where: { name: LINEAR_INTEGRATION_NAME }
		});
		if (!integration) {
			throw new NotFoundException({ message: 'The Linear integration is not in the catalogue', code: LINEAR_NOT_CONNECTED });
		}
		const settings = [
			[LinearSettingName.ACCESS_TOKEN, token.accessToken],
			[LinearSettingName.REFRESH_TOKEN, token.refreshToken ?? ''],
			[LinearSettingName.TOKEN_TYPE, token.tokenType],
			[LinearSettingName.EXPIRES_AT, this.expiresAtOf(token)],
			[LinearSettingName.SCOPE, token.scope ?? ''],
			[LinearSettingName.LINEAR_ORGANIZATION_ID, viewer.organization.id],
			[LinearSettingName.LINEAR_ORGANIZATION_NAME, viewer.organization.name],
			[LinearSettingName.LINEAR_ORGANIZATION_URL_KEY, viewer.organization.urlKey],
			[LinearSettingName.CONNECTED_BY_USER_ID, scope.userId ? String(scope.userId) : ''],
			[LinearSettingName.ATTENTION_REASON, '']
		].map(([settingsName, settingsValue]) => ({ settingsName, settingsValue, tenantId, organizationId }));
		const entitySettings = [IntegrationEntity.PROJECT, IntegrationEntity.ISSUE, IntegrationEntity.LABEL].map((entity) => ({
			entity,
			sync: true,
			tenantId,
			organizationId
		}));
		return this.commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{ name: LINEAR_INTEGRATION_NAME, integration: { provider: LINEAR_INTEGRATION_NAME }, tenantId, organizationId },
				{
					name: LINEAR_INTEGRATION_NAME,
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
	}

	/** Records why the connection needs a person (a refused token), or clears it. */
	async setAttention(tenant: IIntegrationTenant, reason: string | null): Promise<void> {
		try {
			await this.writeSetting(tenant, LinearSettingName.ATTENTION_REASON, reason ?? '');
		} catch (error) {
			this.logger.warn(`The attention reason of connection ${tenant.id} could not be written: ${(error as Error).message}`);
		}
	}

	/** Removes the connection; its mappings and runs go with it (foreign keys). */
	async disconnect(tenant: IIntegrationTenant): Promise<void> {
		await this.integrationTenantService.delete(tenant.id as ID);
	}

	/** Stores a renewed token pair (the refresh token rotated when Linear sent a new one) and clears the attention. */
	private async writeToken(tenant: IIntegrationTenant, token: LinearOAuthToken): Promise<void> {
		await this.writeSetting(tenant, LinearSettingName.ACCESS_TOKEN, token.accessToken);
		if (token.refreshToken) await this.writeSetting(tenant, LinearSettingName.REFRESH_TOKEN, token.refreshToken);
		await this.writeSetting(tenant, LinearSettingName.TOKEN_TYPE, token.tokenType);
		await this.writeSetting(tenant, LinearSettingName.EXPIRES_AT, this.expiresAtOf(token));
		await this.writeSetting(tenant, LinearSettingName.ATTENTION_REASON, '');
	}

	/** Writes one setting row of the connection (updated when it exists, created otherwise) and mirrors it in memory. */
	private async writeSetting(tenant: IIntegrationTenant, name: LinearSettingName, value: string): Promise<void> {
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

	private expiresAtOf(token: LinearOAuthToken): string {
		return token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : '';
	}
}
