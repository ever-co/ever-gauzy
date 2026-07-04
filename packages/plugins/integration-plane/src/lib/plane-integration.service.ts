import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ID, IntegrationEnum, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationService, IntegrationTenantService, RequestContext, TenantApiKeyService } from '@gauzy/core';
import { ConfigService } from '@gauzy/config';
import { generatePassword, generateSha256Hash } from '@gauzy/utils';
import { PlaneSettingName } from './plane-setting.enum';
import { ConfigurePlaneIntegrationDto } from './dto/configure-plane-integration.dto';
import { UpdatePlaneSettingsDto } from './dto/update-plane-settings.dto';

/** Global hosted Ever Gauzy PM UI URLs used when the integration runs in "shared" mode. */
const SHARED_PLANE_WEB_URL = 'https://pm.gauzy.co';
const SHARED_PLANE_ADMIN_URL = ''; // admin (god-mode) not offered in shared mode
const SHARED_PLANE_SPACE_URL = 'https://pm-space.gauzy.co';

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

		if (!tenantId) {
			throw new HttpException(
				'Tenant context is required to configure a Plane integration.',
				HttpStatus.BAD_REQUEST
			);
		}

		// Check if a Plane integration already exists for this tenant

		const existing = await this.findIntegrationTenant(tenantId);
		if (existing) {
			throw new HttpException(
				'Plane integration is already configured for this tenant. Use the update endpoint to modify settings.',
				HttpStatus.CONFLICT
			);
		}


		// Find or create the base Integration record
		const integration = await this.findOrCreateBaseIntegration();

		// Auto-generate API key and secret via TenantApiKeyService
		const apiKeyResponse = await this.tenantApiKeyService.generateApiKey({
			name: 'Plane Integration',
			tenantId
		});

		// Resolve mode (defaults to 'shared' when omitted) and the UI URLs to persist.
		// In shared mode we store the global hosted PM URLs so the proxy's per-tenant
		// CORS resolution keeps working; in custom mode we use the tenant-provided URLs.
		const mode: 'shared' | 'custom' = dto.mode === 'custom' ? 'custom' : 'shared';
		const webUrl = mode === 'custom' ? dto.planeWebUrl : SHARED_PLANE_WEB_URL;
		const adminUrl = mode === 'custom' ? dto.planeAdminUrl || '' : SHARED_PLANE_ADMIN_URL;
		const spaceUrl = mode === 'custom' ? dto.planeSpaceUrl || '' : SHARED_PLANE_SPACE_URL;

		// Build the integration settings array
		const settings: Partial<IIntegrationSetting>[] = [
			{ settingsName: PlaneSettingName.PLANE_MODE, settingsValue: mode },
			{ settingsName: PlaneSettingName.PLANE_WEB_URL, settingsValue: webUrl },
			{ settingsName: PlaneSettingName.PLANE_ADMIN_URL, settingsValue: adminUrl },
			{ settingsName: PlaneSettingName.PLANE_SPACE_URL, settingsValue: spaceUrl },
			{ settingsName: PlaneSettingName.PLANE_API_KEY_VALUE, settingsValue: apiKeyResponse.apiKey },
			{ settingsName: PlaneSettingName.PLANE_API_SECRET_VALUE, settingsValue: apiKeyResponse.apiSecret },
			{ settingsName: PlaneSettingName.IS_ENABLED, settingsValue: 'true' }
		];

		// Create the IntegrationTenant record with cascaded settings
		let integrationTenant: IIntegrationTenant;
		try {
			integrationTenant = await this.integrationTenantService.create({
				name: IntegrationEnum.PLANE,
				integration: integration ?? undefined,
				tenantId,
				organizationId,
				settings: settings as IIntegrationSetting[]
			});
		} catch (error) {
			// Rollback: delete the generated API key if tenant creation fails
			try {
				await this.tenantApiKeyService.delete({ apiKey: apiKeyResponse.apiKey });
			} catch (rollbackError: unknown) {
				this.logger.warn(
					`Failed to rollback API key after setup failure: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
				);
			}
			throw error;
		}

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
		mode: 'shared' | 'custom';
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
			mode: settingsMap[PlaneSettingName.PLANE_MODE] === 'custom' ? 'custom' : 'shared',
			planeWebUrl: settingsMap[PlaneSettingName.PLANE_WEB_URL] || '',
			planeAdminUrl: settingsMap[PlaneSettingName.PLANE_ADMIN_URL] || '',
			planeSpaceUrl: settingsMap[PlaneSettingName.PLANE_SPACE_URL] || '',
			isEnabled: settingsMap[PlaneSettingName.IS_ENABLED] === 'true',
			hasApiKey: !!settingsMap[PlaneSettingName.PLANE_API_KEY_VALUE]
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

		// Revoke the API key before removing the integration.
		// Only tolerate "not found" (key already deleted); propagate real failures
		// so the integration is not archived with a live credential.
		const settings = integrationTenant.settings || [];
		const apiKeySetting = settings.find((s) => s.settingsName === PlaneSettingName.PLANE_API_KEY_VALUE);
		if (apiKeySetting?.settingsValue) {
			try {
				await this.tenantApiKeyService.delete({ apiKey: apiKeySetting.settingsValue });
				this.logger.log(`API key revoked for tenant ${tenantId}`);
			} catch (error: unknown) {
				if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
					this.logger.warn(`API key already deleted for tenant ${tenantId}, proceeding with removal`);
				} else {
					throw error;
				}
			}
		}

		// Soft-delete by marking as archived and inactive
		integrationTenant.isActive = false;
		integrationTenant.isArchived = true;

		// Disable the integration in settings
		const enabledSetting = settings.find((s) => s.settingsName === PlaneSettingName.IS_ENABLED);
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
	 *
	 * Flow: create new key → persist reference → delete old key.
	 * We use TenantApiKeyService.create() directly because generateApiKey()
	 * enforces a tenant-wide one-key limit. Creating first ensures the
	 * integration is never left keyless if any step fails.
	 */
	async regenerateApiKey(organizationId?: string): Promise<{ apiKey: string; apiSecret: string }> {
		const tenantId = RequestContext.currentTenantId() ?? undefined;
		const integrationTenant = await this.findIntegrationTenantOrFail(tenantId);

		const settings = integrationTenant.settings || [];
		const oldApiKeySetting = settings.find((s) => s.settingsName === PlaneSettingName.PLANE_API_KEY_VALUE);
		const oldApiKeyValue = oldApiKeySetting?.settingsValue;

		// 1. Generate new credentials and create a TenantApiKey record first
		const apiKey = generatePassword(32);
		const apiSecret = generatePassword(64);
		const hashedApiSecret = generateSha256Hash(apiSecret);

		const tenantApiKey = await this.tenantApiKeyService.create({
			name: 'Plane Integration',
			apiKey,
			apiSecret: hashedApiSecret
		} as any);

		// 2. Update the settings to point to the new key and secret
		if (oldApiKeySetting) {
			oldApiKeySetting.settingsValue = tenantApiKey.apiKey;
		} else {
			settings.push({
				settingsName: PlaneSettingName.PLANE_API_KEY_VALUE,
				settingsValue: tenantApiKey.apiKey,
				tenantId,
				organizationId
			} as IIntegrationSetting);
		}

		const oldSecretSetting = settings.find((s) => s.settingsName === PlaneSettingName.PLANE_API_SECRET_VALUE);
		if (oldSecretSetting) {
			oldSecretSetting.settingsValue = apiSecret;
		} else {
			settings.push({
				settingsName: PlaneSettingName.PLANE_API_SECRET_VALUE,
				settingsValue: apiSecret,
				tenantId,
				organizationId
			} as IIntegrationSetting);
		}

		// 3. Persist the new key reference
		integrationTenant.settings = settings;
		try {
			await this.integrationTenantService.save(integrationTenant);
		} catch (error) {
			// Save failed — delete the newly generated key to avoid orphans
			try {
				await this.tenantApiKeyService.delete({ apiKey: tenantApiKey.apiKey } as any);
			} catch (rollbackError: unknown) {
				this.logger.warn(
					`Failed to rollback new API key after save failure: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
				);
			}
			throw error;
		}

		// 4. Only delete the old key after the new one is safely persisted
		if (oldApiKeyValue) {
			try {
				await this.tenantApiKeyService.delete({ apiKey: oldApiKeyValue } as any);
			} catch (error: unknown) {
				if (error instanceof NotFoundException) {
					this.logger.warn(`Old API key already deleted for tenant ${tenantId}`);
				} else {
					this.logger.warn(
						`Failed to delete old API key during regeneration: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
		}

		this.logger.log(`Plane integration API key regenerated for tenant ${tenantId}`);

		return {
			apiKey: tenantApiKey.apiKey,
			apiSecret // Return plain text secret (shown once)
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

		const apiKey = settingsMap[PlaneSettingName.PLANE_API_KEY_VALUE] || '';
		const apiSecret = settingsMap[PlaneSettingName.PLANE_API_SECRET_VALUE] || '';

		// The externalBaseApiUrl is the Gauzy API URL including the /api prefix
		const gauzyApiBaseUrl = this.configService.get('baseUrl') || 'http://localhost:3000';

		return {
			externalBaseApiUrl: `${gauzyApiBaseUrl}/api`,
			apiKey,
			apiSecret,
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
		} catch (error: unknown) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Find the Plane IntegrationTenant or throw a 404.
	 */
	private async findIntegrationTenantOrFail(tenantId: ID | undefined): Promise<IIntegrationTenant> {
		const integrationTenant = await this.findIntegrationTenant(tenantId);
		if (!integrationTenant) {
			throw new HttpException('Plane integration is not configured for this tenant.', HttpStatus.NOT_FOUND);
		}
		return integrationTenant;
	}

	/**
	 * Find or create the base Integration record for Plane.
	 */
	private async findOrCreateBaseIntegration() {
		try {
			const existing = await this.integrationService.findOneByOptions({
				where: { provider: 'Plane' }
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
