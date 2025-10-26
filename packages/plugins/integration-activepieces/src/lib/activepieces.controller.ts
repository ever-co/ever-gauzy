import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	Query,
	HttpException,
	HttpStatus,
	HttpCode,
	UseGuards,
	UsePipes,
	ValidationPipe,
	Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ConfigService } from '@gauzy/config';
import { IActivepiecesConfig } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ActivepiecesService } from './activepieces.service';
import { CreateActivepiecesIntegrationDto, ActivepiecesConnectionsListQueryDto } from './dto';
import {
	IActivepiecesConnection,
	IActivepiecesConnectionsListResponse
} from '@gauzy/contracts';

@ApiTags('ActivePieces Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard)
@Controller('/integration/activepieces')
export class ActivepiecesController {
	private readonly logger = new Logger(ActivepiecesController.name);
	constructor(
		private readonly activepiecesService: ActivepiecesService,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Create or update ActivePieces connection (upsert)
	 */
	@ApiOperation({ summary: 'Create or update ActivePieces connection' })
	@ApiResponse({
		status: 201,
		description: 'Successfully created or updated ActivePieces connection'
	})
	@Post('/connection')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	async upsertConnection(@Body() input: CreateActivepiecesIntegrationDto): Promise<IActivepiecesConnection> {
		try {
			return await this.activepiecesService.upsertConnection(input);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to upsert ActivePieces connection', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to upsert ActivePieces connection', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * List connections for a project
	 */
	@ApiOperation({ summary: 'List ActivePieces connections for a project' })
	@ApiResponse({
		status: 200,
		description: 'Returns list of ActivePieces connections'
	})
	@Get('/connections/:integrationId')
	@ApiParam({ name: 'integrationId', description: 'Integration UUID' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async listConnections(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Query() params: ActivepiecesConnectionsListQueryDto
	): Promise<IActivepiecesConnectionsListResponse> {
		try {
			return await this.activepiecesService.listConnections(params, integrationId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to list ActivePieces connections', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to list ActivePieces connections', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get tenant connections
	 */
	@ApiOperation({ summary: 'Get ActivePieces connections for current tenant' })
	@ApiResponse({
		status: 200,
		description: 'Returns tenant ActivePieces connections'
	})
	@Get('/connections/tenant/:integrationId/:projectId')
	@ApiParam({ name: 'integrationId', description: 'Integration UUID' })
	@ApiParam({ name: 'projectId', description: 'ActivePieces project ID' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getTenantConnections(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Param('projectId') projectId: string
	): Promise<IActivepiecesConnection[]> {
		try {
			return await this.activepiecesService.getTenantConnections(projectId, integrationId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get tenant ActivePieces connections', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get tenant ActivePieces connections', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get ActivePieces connection details
	 */
	@ApiOperation({ summary: 'Get ActivePieces connection details' })
	@ApiResponse({
		status: 200,
		description: 'Returns ActivePieces connection details'
	})
	@Get('/connection/:integrationId')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getConnection(
		@Param('integrationId', UUIDValidationPipe) integrationId: string
	): Promise<IActivepiecesConnection | null> {
		try {
			return await this.activepiecesService.getConnection(integrationId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to get ActivePieces connection: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Delete ActivePieces connection
	 */
	@ApiOperation({ summary: 'Delete ActivePieces connection' })
	@ApiResponse({
		status: 204,
		description: 'Successfully deleted ActivePieces connection'
	})
	@Delete('/connection/:integrationId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	async deleteConnection(@Param('integrationId', UUIDValidationPipe) integrationId: string): Promise<void> {
		try {
			const deleted = await this.activepiecesService.deleteConnection(integrationId);
			if (!deleted) {
				throw new HttpException('ActivePieces connection not found', HttpStatus.NOT_FOUND);
			}
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to delete ActivePieces connection: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Check if ActivePieces integration is enabled
	 */
	@ApiOperation({ summary: 'Check if ActivePieces integration is enabled' })
	@ApiResponse({
		status: 200,
		description: 'Returns integration status'
	})
	@Get('/status/:integrationId')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getIntegrationStatus(
		@Param('integrationId', UUIDValidationPipe) integrationId: string
	): Promise<{ enabled: boolean }> {
		try {
			const enabled = await this.activepiecesService.isIntegrationEnabled(integrationId);
			return { enabled };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to get integration status: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get integration tenant information
	 */
	@ApiOperation({ summary: 'Get ActivePieces integration tenant information' })
	@ApiResponse({
		status: 200,
		description: 'Returns integration tenant information'
	})
	@Get('/integration-tenant/:integrationId')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getIntegrationTenant(
		@Param('integrationId', UUIDValidationPipe) integrationId: string
	): Promise<any> {
		try {
			return await this.activepiecesService.getIntegrationTenant(integrationId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get ActivePieces integration', { message: error?.message, stack: error?.stack });
			throw new HttpException(
				'Failed to get ActivePieces integration tenant', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get ActivePieces configuration
	 */
	@ApiOperation({ summary: 'Get ActivePieces OAuth configuration' })
	@ApiResponse({
		status: 200,
		description: 'Returns ActivePieces OAuth configuration'
	})
	@Get('/config')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getConfig(): Promise<Partial<IActivepiecesConfig>> {
		try {
			const config = this.configService.get('activepieces') as IActivepiecesConfig;

			// Return only public configuration, not sensitive data
			return {
				clientId: config?.clientId,
				callbackUrl: config?.callbackUrl
			};
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get ActivePieces configuration', { message: error?.message, stack: error?.stack });
			throw new HttpException(
				'Failed to get ActivePieces configuration', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
