import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ID, IntegrationEnum, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { EverAsyncSettingName, EVER_ASYNC_INTEGRATION_NAME } from './ever-async-setting.enum';
import { ConfigureEverAsyncIntegrationDto } from './dto/configure-ever-async-integration.dto';
import { UpdateEverAsyncSettingsDto } from './dto/update-ever-async-settings.dto';
import { EverAsyncUserMappingDto } from './dto/ever-async-user-mapping.dto';

/** Timeout (ms) for the /healthz connectivity check against the Ever Async server. */
const HEALTHZ_TIMEOUT_MS = 5000;

@Injectable()
export class EverAsyncIntegrationService {
	private readonly logger = new Logger(EverAsyncIntegrationService.name);

	constructor(
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly httpService: HttpService
	) {}

	/**
	 * Configure the Ever Async integration for the current tenant.
	 * Finds or creates the base Integration record and stores the server URL,
	 * API token (write-only) and user mappings as integration settings.
	 *
	 * @param dto - Server URL, API token and optional user mappings
	 * @param organizationId - Optional organization scope
	 * @returns The created integration tenant ID
	 */
	async setupIntegration(
		dto: ConfigureEverAsyncIntegrationDto,
		organizationId?: string
	): Promise<{ integrationTenantId: ID }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		organizationId = organizationId ?? RequestContext.currentOrganizationId() ?? undefined;

		if (!tenantId) {
			throw new HttpException(
				'Tenant context is required to configure an Ever Async integration.',
				HttpStatus.BAD_REQUEST
			);
		}

		// Check if an Ever Async integration already exists for this tenant
		const existing = await this.findIntegrationTenant(tenantId);
		if (existing) {
			throw new HttpException(
				'Ever Async integration is already configured for this tenant. Use the update endpoint to modify settings.',
				HttpStatus.CONFLICT
			);
		}

		// Find or create the base Integration record
		const integration = await this.findOrCreateBaseIntegration();

		// Build the integration settings array
		const settings: Partial<IIntegrationSetting>[] = [
			{ settingsName: EverAsyncSettingName.EVER_ASYNC_SERVER_URL, settingsValue: dto.serverUrl },
			{ settingsName: EverAsyncSettingName.EVER_ASYNC_API_TOKEN, settingsValue: dto.apiToken },
			{
				settingsName: EverAsyncSettingName.EVER_ASYNC_USER_MAPPINGS,
				settingsValue: JSON.stringify(dto.userMappings ?? [])
			},
			{ settingsName: EverAsyncSettingName.IS_ENABLED, settingsValue: 'true' }
		];

		// Create the IntegrationTenant record with cascaded settings
		const integrationTenant = await this.integrationTenantService.create({
			// scaffold: replace with `IntegrationEnum.EVER_ASYNC` once the enum
			// member is added to @gauzy/contracts (see ever-async-setting.enum.ts)
			name: EVER_ASYNC_INTEGRATION_NAME as IntegrationEnum,
			integration: integration ?? undefined,
			tenantId,
			organizationId,
			settings: settings as IIntegrationSetting[]
		});

		this.logger.log(`Ever Async integration configured for tenant ${tenantId}`);

		return { integrationTenantId: integrationTenant.id! };
	}

	/**
	 * Retrieve the current Ever Async integration settings for the tenant.
	 * The API token is NOT returned (write-only credential) — only a
	 * `hasApiToken` flag.
	 */
	async getSettings(_organizationId?: string): Promise<{
		integrationTenantId: ID;
		serverUrl: string;
		userMappings: EverAsyncUserMappingDto[];
		isEnabled: boolean;
		hasApiToken: boolean;
	}> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);

		return {
			integrationTenantId: integrationTenant.id!,
			serverUrl: settingsMap[EverAsyncSettingName.EVER_ASYNC_SERVER_URL] || '',
			userMappings: this.parseUserMappings(settingsMap[EverAsyncSettingName.EVER_ASYNC_USER_MAPPINGS]),
			isEnabled: settingsMap[EverAsyncSettingName.IS_ENABLED] === 'true',
			hasApiToken: !!settingsMap[EverAsyncSettingName.EVER_ASYNC_API_TOKEN]
		};
	}

	/**
	 * Update Ever Async settings for the current tenant.
	 * Only the fields supplied in the DTO are patched; `apiToken` replaces the
	 * stored token when provided.
	 */
	async updateSettings(
		dto: UpdateEverAsyncSettingsDto,
		organizationId?: string
	): Promise<{ integrationTenantId: ID; updated: boolean }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		const existingSettings = integrationTenant.settings || [];

		// Build a map of setting name → setting object for easy update
		const settingsIndex = new Map<string, IIntegrationSetting>();
		for (const s of existingSettings) {
			settingsIndex.set(s.settingsName, s);
		}

		const updates: Array<[string, string | undefined]> = [
			[EverAsyncSettingName.EVER_ASYNC_SERVER_URL, dto.serverUrl],
			[EverAsyncSettingName.EVER_ASYNC_API_TOKEN, dto.apiToken],
			[
				EverAsyncSettingName.EVER_ASYNC_USER_MAPPINGS,
				dto.userMappings !== undefined ? JSON.stringify(dto.userMappings) : undefined
			]
		];

		for (const [name, value] of updates) {
			if (value !== undefined) {
				const existing = settingsIndex.get(name);
				if (existing) {
					existing.settingsValue = value;
				} else {
					existingSettings.push({
						settingsName: name,
						settingsValue: value,
						tenantId,
						organizationId
					} as IIntegrationSetting);
				}
			}
		}

		integrationTenant.settings = existingSettings;
		await this.integrationTenantService.save(integrationTenant);

		this.logger.log(`Ever Async integration settings updated for tenant ${tenantId}`);

		return {
			integrationTenantId: integrationTenant.id!,
			updated: true
		};
	}

	/**
	 * Verify connectivity to the Ever Async server by pinging `GET {serverUrl}/healthz`.
	 * Uses the provided URL (connect wizard) or falls back to the stored setting.
	 */
	async verifyConnection(serverUrl?: string): Promise<{ ok: boolean; serverUrl: string }> {
		let targetUrl = serverUrl;

		if (!targetUrl) {
			const tenantId = RequestContext.currentTenantId() ?? undefined;
			const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);
			const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);
			targetUrl = settingsMap[EverAsyncSettingName.EVER_ASYNC_SERVER_URL];
		}

		if (!targetUrl) {
			throw new HttpException('No Ever Async server URL to verify.', HttpStatus.BAD_REQUEST);
		}

		const healthzUrl = `${targetUrl.replace(/\/+$/, '')}/healthz`;

		try {
			// The Ever Async server exposes an unauthenticated /healthz endpoint
			// (see ever-co/ever-async docs/integrations/gauzy.md).
			await firstValueFrom(this.httpService.get(healthzUrl, { timeout: HEALTHZ_TIMEOUT_MS }));
			return { ok: true, serverUrl: targetUrl };
		} catch (error: unknown) {
			this.logger.warn(
				`Ever Async healthz check failed for ${healthzUrl}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			throw new HttpException(
				`Ever Async server is not reachable at ${targetUrl}.`,
				HttpStatus.BAD_GATEWAY
			);
		}
	}

	/**
	 * Check if the Ever Async integration is enabled for the current tenant.
	 */
	async getStatus(): Promise<{ isEnabled: boolean; integrationTenantId: ID | null }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = tenantId ? await this.findIntegrationTenant(tenantId) : null;

		if (!integrationTenant) {
			return { isEnabled: false, integrationTenantId: null };
		}

		const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);

		return {
			isEnabled: !!integrationTenant.isActive && settingsMap[EverAsyncSettingName.IS_ENABLED] === 'true',
			integrationTenantId: integrationTenant.id ?? null
		};
	}

	/**
	 * Remove/archive the Ever Async integration for the tenant (soft delete).
	 */
	async removeIntegration(integrationTenantId: ID): Promise<{ success: boolean }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		if (integrationTenant.id !== integrationTenantId) {
			throw new HttpException('Integration tenant ID mismatch.', HttpStatus.BAD_REQUEST);
		}

		// Soft-delete by marking as archived and inactive
		integrationTenant.isActive = false;
		integrationTenant.isArchived = true;

		// Disable the integration in settings
		const settings = integrationTenant.settings || [];
		const enabledSetting = settings.find((s) => s.settingsName === EverAsyncSettingName.IS_ENABLED);
		if (enabledSetting) {
			enabledSetting.settingsValue = 'false';
		}

		await this.integrationTenantService.save(integrationTenant);

		this.logger.log(`Ever Async integration removed for tenant ${tenantId}`);

		return { success: true };
	}

	/**
	 * Find the Ever Async IntegrationTenant for the given tenant ID.
	 */
	private async findIntegrationTenant(tenantId: ID | undefined): Promise<IIntegrationTenant | null> {
		if (!tenantId) {
			return null;
		}

		try {
			return await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					name: EVER_ASYNC_INTEGRATION_NAME as IntegrationEnum,
					isActive: true,
					isArchived: false
				},
				relations: ['settings']
			});
		} catch (error: unknown) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Find the Ever Async IntegrationTenant or throw a 404.
	 */
	private async findIntegrationTenantOrFail(tenantId: ID | undefined): Promise<IIntegrationTenant> {
		const integrationTenant = await this.findIntegrationTenant(tenantId);
		if (!integrationTenant) {
			throw new HttpException('Ever Async integration is not configured for this tenant.', HttpStatus.NOT_FOUND);
		}
		return integrationTenant;
	}

	/**
	 * Find or create the base Integration record for Ever Async.
	 */
	private async findOrCreateBaseIntegration() {
		try {
			const existing = await this.integrationService.findOneByOptions({
				where: { provider: 'Ever_Async' }
			});
			if (existing) {
				return existing;
			}
		} catch (error: unknown) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		return await this.integrationService.create({
			name: 'Ever Async',
			provider: 'Ever_Async',
			// scaffold: add the `integrations/ever-async.svg` icon asset during
			// wiring (same location as `integrations/plane.svg`)
			imgSrc: 'integrations/ever-async.svg',
			isComingSoon: false,
			isPaid: false,
			redirectUrl: 'ever-async',
			order: 12
		});
	}

	/**
	 * Build a key-value map from an array of IntegrationSettings.
	 */
	private buildSettingsMap(settings: IIntegrationSetting[]): Record<string, string> {
		const map: Record<string, string> = {};
		for (const s of settings) {
			map[s.settingsName] = s.settingsValue;
		}
		return map;
	}

	/**
	 * Parse the JSON-serialized user mappings setting, tolerating bad data.
	 */
	private parseUserMappings(raw: string | undefined): EverAsyncUserMappingDto[] {
		if (!raw) {
			return [];
		}
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			this.logger.warn('Failed to parse stored Ever Async user mappings; returning empty list.');
			return [];
		}
	}
}
