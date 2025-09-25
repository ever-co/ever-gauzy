import { TypeOrmActivepiecesIntegrationRepository } from './repository/type-orm-activepieces-integration.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { IActivepiecesConfig } from '@gauzy/common';
import {
	IActivepiecesIntegrationConfigCreateInput,
	IActivepiecesIntegrationConfigUpdateInput,
} from '@gauzy/contracts';
import { ActivepiecesIntegration } from './activepieces-integration.entity';

@Injectable()
export class ActivepiecesConfigService {
	private readonly logger = new Logger(ActivepiecesConfigService.name);
	constructor(
		private readonly activepiecesIntegrationRepository: TypeOrmActivepiecesIntegrationRepository,
		private readonly configService: ConfigService
	) { }

	/**
	 * Get configuration for a specific tenant and organization
	 * Falls back to global configuration if tenant-specific config is not found
	 *
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns ActivePieces configuration
	 */
	async getConfig(tenantId: string, organizationId?: string): Promise<ActivepiecesIntegration> {
		try {
			// First try to get tenant-specific configuration
			const tenantConfig = await this.activepiecesIntegrationRepository.findOne({
				where: {
					tenantId,
					...(organizationId && { organizationId }),
					isActive: true
				}
			});

			if (tenantConfig) {
				return {
					clientId: tenantConfig.clientId,
					clientSecret: tenantConfig.clientSecret,
					callbackUrl: tenantConfig.callbackUrl || this.getDefaultCallbackUrl(),
					postInstallUrl: tenantConfig.postInstallUrl || this.getDefaultPostInstallUrl(),
					isActive: tenantConfig.isActive,
					description: tenantConfig.description
				};
			}

			// Fallback to global configuration
			const globalConfig = this.configService.get('activepieces') as IActivepiecesConfig;

			if (!globalConfig?.clientId) {
				throw new Error('ActivePieces integration not configured');
			}

			return globalConfig;
		} catch (error: any) {
			throw new Error(`Failed to get ActivePieces configuration: ${error.message}`);
		}
	}

	/**
	 * Check if tenant has specific configuration
	 *
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns boolean indicating if tenant-specific config exists
	 */
	async hasTenantConfig(tenantId: string, organizationId?: string): Promise<boolean> {
		const count = await this.activepiecesIntegrationRepository.count({
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				isActive: true
			}
		});
		return count > 0;
	}

	/**
	 * Set tenant-specific configuration
	 *
	 * @param tenantId - The tenant ID
	 * @param config - Configuration data
	 * @returns Created or updated configuration
	 */
	async setTenantConfig(
		tenantId: string,
		config: IActivepiecesIntegrationConfigCreateInput
	): Promise<ActivepiecesIntegration> {
		try {
			// Check if configuration already exists
			const existingConfig = await this.activepiecesIntegrationRepository.findOne({
				where: {
					tenantId,
					organizationId: config.organizationId
				}
			});

			if (existingConfig) {
				// Update existing configuration
				const updatedConfig = await this.activepiecesIntegrationRepository.save({
					...existingConfig,
					...config,
					tenantId
				});
				return updatedConfig;
			} else {
				// Create new configuration
				const newConfig = this.activepiecesIntegrationRepository.create({
					...config,
					tenantId,
					isActive: config.isActive ?? true
				});
				return await this.activepiecesIntegrationRepository.save(newConfig);
			}
		} catch (error: any) {
			throw new Error(`Failed to set tenant configuration: ${error.message}`);
		}
	}

	/**
	 * Update tenant-specific configuration
	 *
	 * @param id - Configuration ID
	 * @param config - Updated configuration data
	 * @returns Updated configuration
	 */
	async updateTenantConfig(
		id: string,
		config: IActivepiecesIntegrationConfigUpdateInput
	): Promise<ActivepiecesIntegration> {
		try {
			const existingConfig = await this.activepiecesIntegrationRepository.findOne({
				where: { id }
			});

			if (!existingConfig) {
				throw new Error('Configuration not found');
			}

			const updatedConfig = await this.activepiecesIntegrationRepository.save({
				...existingConfig,
				...config
			});

			return updatedConfig;
		} catch (error: any) {
			throw new Error(`Failed to update tenant configuration: ${error.message}`);
		}
	}

	/**
	 * Delete tenant-specific configuration
	 *
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns boolean indicating success
	 */
	async deleteTenantConfig(tenantId: string, organizationId?: string): Promise<boolean> {
		try {
			const result = await this.activepiecesIntegrationRepository.delete({
				tenantId,
				...(organizationId && { organizationId })
			});
			return (result.affected ?? 0) > 0;
		} catch (error: any) {
			throw new Error(`Failed to delete tenant configuration: ${error.message}`);
		}
	}

	/**
	 * Get all configurations for a tenant
	 *
	 * @param tenantId - The tenant ID
	 * @returns Array of configurations
	 */
	async getTenantConfigs(tenantId: string): Promise<ActivepiecesIntegration[]> {
		return await this.activepiecesIntegrationRepository.find({
			where: { tenantId },
			order: { createdAt: 'DESC' }
		});
	}

	/**
	 * Get default callback URL from global configuration
	 *
	 * @returns Default callback URL
	 */
	private getDefaultCallbackUrl(): string {
		const globalConfig = this.configService.get('activepieces') as IActivepiecesConfig;
		return globalConfig?.callbackUrl || `${process.env['API_BASE_URL']}/api/integration/activepieces/callback`;
	}

	/**
	 * Get default post-install URL from global configuration
	 *
	 * @returns Default post-install URL
	 */
	private getDefaultPostInstallUrl(): string {
		const globalConfig = this.configService.get('activepieces') as IActivepiecesConfig;
		return globalConfig?.postInstallUrl || `${process.env['CLIENT_BASE_URL']}/#/pages/integrations/activepieces`;
	}
}
