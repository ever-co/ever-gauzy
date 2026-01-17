import { Injectable, Logger } from '@nestjs/common';
import { TenantSettingService } from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { IPosthogConfig } from '@gauzy/common';
import { environment } from '@gauzy/config';
import { PosthogModuleOptions } from './posthog.interfaces';

/**
 * Setting names for PostHog configuration in tenant_setting table.
 * Uses the property names from IPosthogConfig interface directly.
 */
const POSTHOG_SETTING_NAMES: (keyof IPosthogConfig | string)[] = [
	'posthogKey',
	'posthogHost',
	'posthogEnabled',
	'posthogFlushInterval',
	// Additional settings not in IPosthogConfig
	'posthogFlushAt',
	'posthogEnableErrorTracking',
	'posthogAutocapture'
];

/**
 * Service for retrieving PostHog configuration with hierarchical cascade resolution.
 * Priority (highest to lowest): Tenant DB → Global DB (tenantId=NULL) → Environment variables
 */
@Injectable()
export class PosthogConfigService {
	private readonly logger = new Logger(PosthogConfigService.name);

	constructor(private readonly tenantSettingService: TenantSettingService) {}

	/**
	 * Get PostHog configuration with cascading resolution.
	 *
	 * @param tenantId - Optional tenant ID for tenant-specific settings
	 * @returns PosthogModuleOptions with resolved settings
	 */
	async getConfig(tenantId?: ID): Promise<PosthogModuleOptions> {
		// Get environment config with proper typing
		const envConfig: Partial<IPosthogConfig> = environment.posthog ?? {};

		// Environment variable defaults using IPosthogConfig property names
		const envDefaults: Record<string, string> = {
			posthogKey: envConfig.posthogKey ?? '',
			posthogHost: envConfig.posthogHost ?? 'https://app.posthog.com',
			posthogEnabled: String(envConfig.posthogEnabled ?? false),
			posthogFlushInterval: String(envConfig.posthogFlushInterval ?? 10000)
		};

		// Get resolved settings from DB with fallback to env
		const resolvedSettings = await this.tenantSettingService.getResolvedSettings(
			POSTHOG_SETTING_NAMES,
			tenantId,
			envDefaults
		);

		const apiKey = resolvedSettings['posthogKey'] || '';
		const enabled = resolvedSettings['posthogEnabled'] === 'true';

		if (!enabled || !apiKey) {
			this.logger.debug(
				`PostHog disabled for tenant ${tenantId || 'global'}: enabled=${enabled}, hasApiKey=${!!apiKey}`
			);
		}

		return {
			apiKey,
			apiHost: resolvedSettings['posthogHost'] || 'https://app.posthog.com',
			enableErrorTracking: resolvedSettings['posthogEnableErrorTracking'] !== 'false',
			flushInterval: parseInt(resolvedSettings['posthogFlushInterval'], 10) || 10000,
			flushAt: parseInt(resolvedSettings['posthogFlushAt'], 10) || 20,
			autocapture: resolvedSettings['posthogAutocapture'] === 'true'
		};
	}

	/**
	 * Check if PostHog is enabled for a specific tenant.
	 *
	 * @param tenantId - Optional tenant ID
	 * @returns true if PostHog is enabled and has an API key
	 */
	async isEnabled(tenantId?: ID): Promise<boolean> {
		// Get resolved settings to check the enabled flag directly
		const envConfig: Partial<IPosthogConfig> = environment.posthog ?? {};
		const envDefaults: Record<string, string> = {
			posthogKey: envConfig.posthogKey ?? '',
			posthogEnabled: String(envConfig.posthogEnabled ?? false)
		};

		const resolvedSettings = await this.tenantSettingService.getResolvedSettings(
			['posthogKey', 'posthogEnabled'],
			tenantId,
			envDefaults
		);

		const enabled = resolvedSettings['posthogEnabled'] === 'true';
		const hasApiKey = !!resolvedSettings['posthogKey'];

		return enabled && hasApiKey;
	}
}
