import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ID, IntegrationEnum, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import {
	IntegrationService,
	IntegrationTenantService,
	RequestContext,
	TenantApiKeyService
} from '@gauzy/core';
import { ConfigService } from '@gauzy/config';
import { PlaneSettingName } from './plane-setting.enum';
import { ConfigurePlaneIntegrationDto } from './dto/configure-plane-integration.dto';
import { UpdatePlaneSettingsDto } from './dto/update-plane-settings.dto';

@Injectable()
export class PlaneIntegrationService {
	private readonly logger = new Logger(PlaneIntegrationService.name);

	constructor(
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly tenantApiKeyService: TenantApiKeyService,
		private readonly configService: ConfigService
	) {}

	/**
	 * Configure Plane integration for the current tenant.
	 * Finds or creates the base Integration record, auto-generates API credentials,
	 * and stores all settings in the database.
	 *
	 * @param dto - The Plane UI URLs to configure
	 * @param organizationId - Optional organization scope
	 * @returns Integration tenant ID and the generated API credentials (plain text, shown once)
	 */
	async setupIntegration(
		dto: ConfigurePlaneIntegrationDto,
		organizationId?: string
	): Promise<{ integrationTenantId: ID; apiKey: string; apiSecret: string }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		organizationId = organizationId ?? RequestContext.currentOrganizationId() ?? undefined;

		// Check if a Plane integration already exists for this tenant
		if (tenantId) {
			const existing = await this.findIntegrationTenant(tenantId);
			if (existing) {
				throw new HttpException(
					'Plane integration is already configured for this tenant. Use the update endpoint to modify settings.',
					HttpStatus.CONFLICT
				);
			}
		}

		// Find or create the base Integration record
		const integration = await this.findOrCreateBaseIntegration();

		// Auto-generate API key and secret via TenantApiKeyService
		const apiKeyResponse = await this.tenantApiKeyService.generateApiKey({
			name: 'Plane Integration',
			tenantId
		});

		// Build the integration settings array
		const settings: Partial<IIntegrationSetting>[] = [
			{ settingsName: PlaneSettingName.PLANE_WEB_URL, settingsValue: dto.planeWebUrl },
			{ settingsName: PlaneSettingName.PLANE_ADMIN_URL, settingsValue: dto.planeAdminUrl || '' },
			{ settingsName: PlaneSettingName.PLANE_SPACE_URL, settingsValue: dto.planeSpaceUrl || '' },
			{ settingsName: PlaneSettingName.PLANE_API_KEY_ID, settingsValue: apiKeyResponse.apiKey },
			{ settingsName: PlaneSettingName.IS_ENABLED, settingsValue: 'true' }
		];

		// Create the IntegrationTenant record with cascaded settings
		const integrationTenant = await this.integrationTenantService.create({
			name: IntegrationEnum.PLANE,
			integration: integration ?? undefined,
			tenantId,
			organizationId,
			settings: settings as IIntegrationSetting[]
		});

		this.logger.log(`Plane integration configured for tenant ${tenantId}`);

		return {
			integrationTenantId: integrationTenant.id!,
			apiKey: apiKeyResponse.apiKey,
			apiSecret: apiKeyResponse.apiSecret
		};
	}

	/**
	 * Retrieve the current Plane integration settings for the tenant.
	 * API key and secret are NOT returned (security).
	 */
	async getSettings(_organizationId?: string): Promise<{
		integrationTenantId: ID;
		planeWebUrl: string;
		planeAdminUrl: string;
		planeSpaceUrl: string;
		isEnabled: boolean;
		hasApiKey: boolean;
	}> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);

		return {
			integrationTenantId: integrationTenant.id!,
			planeWebUrl: settingsMap[PlaneSettingName.PLANE_WEB_URL] || '',
			planeAdminUrl: settingsMap[PlaneSettingName.PLANE_ADMIN_URL] || '',
			planeSpaceUrl: settingsMap[PlaneSettingName.PLANE_SPACE_URL] || '',
			isEnabled: settingsMap[PlaneSettingName.IS_ENABLED] === 'true',
			hasApiKey: !!settingsMap[PlaneSettingName.PLANE_API_KEY_ID]
		};
	}

	/**
	 * Update Plane UI URLs for the current tenant.
	 */
	async updateSettings(
		dto: UpdatePlaneSettingsDto,
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

		// Update only the provided fields
		const updates: Array<[string, string | undefined]> = [
			[PlaneSettingName.PLANE_WEB_URL, dto.planeWebUrl],
			[PlaneSettingName.PLANE_ADMIN_URL, dto.planeAdminUrl],
			[PlaneSettingName.PLANE_SPACE_URL, dto.planeSpaceUrl]
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

		this.logger.log(`Plane integration settings updated for tenant ${tenantId}`);

		return {
			integrationTenantId: integrationTenant.id!,
			updated: true
		};
	}

	/**
	 * Remove/archive Plane integration for the tenant.
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
		const enabledSetting = (integrationTenant.settings || []).find(
			(s) => s.settingsName === PlaneSettingName.IS_ENABLED
		);
		if (enabledSetting) {
			enabledSetting.settingsValue = 'false';
		}

		await this.integrationTenantService.save(integrationTenant);

		this.logger.log(`Plane integration removed for tenant ${tenantId}`);

		return { success: true };
	}

	/**
	 * Regenerate API key and secret for the Plane integration.
	 * The old credentials become invalid.
	 */
	async regenerateApiKey(organizationId?: string): Promise<{ apiKey: string; apiSecret: string }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		// Delete the old API key before generating a new one (generateApiKey rejects duplicates per tenant)
		const settings = integrationTenant.settings || [];
		const oldApiKeySetting = settings.find((s) => s.settingsName === PlaneSettingName.PLANE_API_KEY_ID);
		if (oldApiKeySetting?.settingsValue) {
			try {
				await this.tenantApiKeyService.delete({ apiKey: oldApiKeySetting.settingsValue });
			} catch (error: unknown) {
				this.logger.warn(`Failed to delete old API key during regeneration: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		// Generate a new API key/secret pair
		const apiKeyResponse = await this.tenantApiKeyService.generateApiKey({
			name: 'Plane Integration',
			tenantId
		});

		// Update the PLANE_API_KEY_ID setting
		if (oldApiKeySetting) {
			oldApiKeySetting.settingsValue = apiKeyResponse.apiKey;
		} else {
			settings.push({
				settingsName: PlaneSettingName.PLANE_API_KEY_ID,
				settingsValue: apiKeyResponse.apiKey,
				tenantId,
				organizationId
			} as IIntegrationSetting);
		}

		integrationTenant.settings = settings;
		await this.integrationTenantService.save(integrationTenant);

		this.logger.log(`Plane integration API key regenerated for tenant ${tenantId}`);

		return {
			apiKey: apiKeyResponse.apiKey,
			apiSecret: apiKeyResponse.apiSecret
		};
	}

	/**
	 * Check if Plane integration is enabled for the current tenant.
	 */
	async getStatus(): Promise<{ isEnabled: boolean; integrationTenantId: ID | null }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = tenantId ? await this.findIntegrationTenant(tenantId) : null;

		if (!integrationTenant) {
			return { isEnabled: false, integrationTenantId: null };
		}

		const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);

		return {
			isEnabled: !!integrationTenant.isActive && settingsMap[PlaneSettingName.IS_ENABLED] === 'true',
			integrationTenantId: integrationTenant.id ?? null
		};
	}

	/**
	 * Resolve the full Plane proxy configuration for a given tenant.
	 * Used by PlaneProxyService for per-request config resolution.
	 */
	async getConfigForTenant(tenantId: ID): Promise<{
		externalBaseApiUrl: string;
		apiKey: string;
		apiSecret: string;
		clientBaseUrl: string;
		clientAdminUrl: string;
		clientSpaceUrl: string;
	} | null> {
		const integrationTenant = await this.findIntegrationTenant(tenantId);

		if (!integrationTenant || !integrationTenant.isActive) {
			return null;
		}

		const settingsMap = this.buildSettingsMap(integrationTenant.settings || []);

		if (settingsMap[PlaneSettingName.IS_ENABLED] !== 'true') {
			return null;
		}

		const apiKey = settingsMap[PlaneSettingName.PLANE_API_KEY_ID] || '';

		// The externalBaseApiUrl is the Gauzy API URL for this deployment
		const gauzyApiBaseUrl = this.configService.get('baseUrl') || 'http://localhost:3000';

		return {
			externalBaseApiUrl: gauzyApiBaseUrl,
			apiKey,
			apiSecret: '', // The proxy uses the apiKey for X-APP-ID; the secret is validated server-side
			clientBaseUrl: settingsMap[PlaneSettingName.PLANE_WEB_URL] || '',
			clientAdminUrl: settingsMap[PlaneSettingName.PLANE_ADMIN_URL] || '',
			clientSpaceUrl: settingsMap[PlaneSettingName.PLANE_SPACE_URL] || ''
		};
	}

	/**
	 * Find the Plane IntegrationTenant for the given tenant ID.
	 */
	private async findIntegrationTenant(tenantId: ID | undefined): Promise<IIntegrationTenant | null> {
		if (!tenantId) {
			return null;
		}

		try {
			return await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					name: IntegrationEnum.PLANE,
					isActive: true,
					isArchived: false
				},
				relations: ['settings']
			});
		} catch {
			return null;
		}
	}

	/**
	 * Find the Plane IntegrationTenant or throw a 404.
	 */
	private async findIntegrationTenantOrFail(tenantId: ID | undefined): Promise<IIntegrationTenant> {
		const integrationTenant = await this.findIntegrationTenant(tenantId);
		if (!integrationTenant) {
			throw new HttpException(
				'Plane integration is not configured for this tenant.',
				HttpStatus.NOT_FOUND
			);
		}
		return integrationTenant;
	}

	/**
	 * Find or create the base Integration record for Plane.
	 */
	private async findOrCreateBaseIntegration() {
		const existing = await this.integrationService.findOneByOptions({
			where: { provider: 'Plane' }
		}).catch(() => null);

		if (existing) {
			return existing;
		}

		return await this.integrationService.create({
			name: 'Plane',
			provider: 'Plane',
			imgSrc: 'integrations/plane.svg',
			isComingSoon: false,
			isPaid: false,
			redirectUrl: 'plane',
			order: 11
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
}
