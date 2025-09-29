import {
	Controller,
	Post,
	Get,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpException,
	HttpStatus,
	UsePipes,
	ValidationPipe,
	UseGuards,
	BadRequestException,
	Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IActivepiecesIntegrationConfigCreateInput, IActivepiecesIntegrationConfigUpdateInput, ID } from '@gauzy/contracts';
import { TenantPermissionGuard, Permissions, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ActivepiecesConfigService } from './activepieces-config.service';
import { ActivepiecesConfigCreateDto, ActivepiecesConfigUpdateDto } from './dto';

@ApiTags('ActivePieces Configuration')
@UseGuards(TenantPermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/activepieces/config')
export class ActivepiecesConfigController {
	private readonly logger = new Logger(ActivepiecesConfigController.name);
	constructor(private readonly activepiecesConfigService: ActivepiecesConfigService) {}

	/**
	 * Create tenant-specific ActivePieces configuration
	 *
	 * @param config - Configuration data
	 * @param organizationId - Optional organization ID
	 * @returns Created configuration
	 */
	@ApiOperation({
		summary: 'Create tenant-specific ActivePieces OAuth configuration',
		description: 'Creates a new OAuth configuration for the tenant, allowing them to use their own ActivePieces credentials'
	})
	@ApiResponse({
		status: 201,
		description: 'Configuration created successfully',
		type: Object
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid configuration data'
	})
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: 'Optional organization ID'
	})
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async createConfig(
		@Body() config: ActivepiecesConfigCreateDto,
		@Query('organizationId') organizationId?: string
	): Promise<IActivepiecesIntegrationConfigCreateInput> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			const created = await this.activepiecesConfigService.setTenantConfig(tenantId, {
				...config,
				tenantId,
				organizationId
			});
			return {
				...created,
				clientId: created.clientId,
				clientSecret: created.clientSecret
			};
		} catch (error: any) {
			this.logger.error('Failed to create ActivePieces configuration', error as Error);
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				`Failed to create ActivePieces configuration: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * Get tenant-specific ActivePieces configuration status
	 *
	 * @param organizationId - Optional organization ID
	 * @returns Configuration status
	 */
	@ApiOperation({
		summary: 'Get ActivePieces configuration status',
		description: 'Returns information about whether the tenant has configured their own ActivePieces credentials'
	})
	@ApiResponse({
		status: 200,
		description: 'Configuration status retrieved successfully',
		schema: {
			type: 'object',
			properties: {
				hasTenantConfig: { type: 'boolean' },
				hasGlobalConfig: { type: 'boolean' },
				callbackUrl: { type: 'string' },
				postInstallUrl: { type: 'string' }
			}
		}
	})
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: 'Optional organization ID'
	})
	@Get('/status')
	async getConfigStatus(@Query('organizationId') organizationId?: string) {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			const hasTenantConfig = await this.activepiecesConfigService.hasTenantConfig(
				tenantId,
				organizationId
			);

			const config = await this.activepiecesConfigService.getConfig(tenantId, organizationId);

			return {
				hasTenantConfig,
				hasGlobalConfig: !hasTenantConfig && !!config.clientId,
				callbackUrl: config.callbackUrl,
				postInstallUrl: config.postInstallUrl
			};
		} catch (error: any) {
			this.logger.error('Failed to get configuration status', error as Error);
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				`Failed to get configuration status: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get all tenant configurations
	 *
	 * @returns Array of tenant configurations
	 */
	@ApiOperation({
		summary: 'Get all tenant ActivePieces configurations',
		description: 'Returns all ActivePieces configurations for the current tenant'
	})
	@ApiResponse({
		status: 200,
		description: 'Configurations retrieved successfully',
		type: [Object]
	})
	@Get()
	async getTenantConfigs() {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			const configs = await this.activepiecesConfigService.getTenantConfigs(tenantId);

			// Remove sensitive data from response
			return configs.map(config => ({
				...config,
				clientId: config.clientId ? '***' : undefined,
				clientSecret: config.clientSecret ? '***' : undefined
			}));
		} catch (error: any) {
			this.logger.error('Failed to get tenant configurations', error as Error);
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				`Failed to get tenant configurations: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Update tenant-specific ActivePieces configuration
	 *
	 * @param id - Configuration ID
	 * @param config - Updated configuration data
	 * @returns Updated configuration
	 */
	@ApiOperation({
		summary: 'Update tenant-specific ActivePieces configuration',
		description: 'Updates an existing OAuth configuration for the tenant'
	})
	@ApiParam({ name: 'id', description: 'Configuration ID', type: 'string' })
	@ApiResponse({
		status: 200,
		description: 'Configuration updated successfully',
		type: Object
	})
	@ApiResponse({
		status: 404,
		description: 'Configuration not found'
	})
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async updateConfig(
		@Param('id') id: ID,
		@Query('tenantId') tenantId: string,
		@Body() config: ActivepiecesConfigUpdateDto
	): Promise<IActivepiecesIntegrationConfigUpdateInput> {
		try {
			const updatedConfig = await this.activepiecesConfigService.updateTenantConfig(id, tenantId, config);

			// Remove sensitive data from response
			return {
				...updatedConfig,
				clientId: updatedConfig.clientId ? '***' : undefined,
				clientSecret: updatedConfig.clientSecret ? '***' : undefined
			};
		} catch (error: any) {
			this.logger.error('Failed to update ActivePieces configuration', error as Error);
			if (error instanceof HttpException) throw error;
			const status = error.message.includes('not found') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
			throw new HttpException(
				`Failed to update ActivePieces configuration: ${error.message}`,
				status
			);
		}
	}

	/**
	 * Delete tenant-specific ActivePieces configuration
	 *
	 * @param organizationId - Optional organization ID
	 * @returns Success status
	 */
	@ApiOperation({
		summary: 'Delete tenant-specific ActivePieces configuration',
		description: 'Deletes the OAuth configuration for the tenant, falling back to global configuration'
	})
	@ApiResponse({
		status: 200,
		description: 'Configuration deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' }
			}
		}
	})
	@ApiQuery({
		name: 'organizationId',
		required: false,
		type: String,
		description: 'Optional organization ID'
	})
	@Delete()
	async deleteConfig(@Query('organizationId') organizationId?: string) {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required');
			}

			const deleted = await this.activepiecesConfigService.deleteTenantConfig(
				tenantId,
				organizationId
			);

			return {
				success: deleted,
				message: deleted
					? 'Configuration deleted successfully. Fallback to global configuration.'
					: 'No configuration found to delete.'
			};
		} catch (error: any) {
			this.logger.error('Failed to delete ActivePieces configuration', error as Error);
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				`Failed to delete ActivePieces configuration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
