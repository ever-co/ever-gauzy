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
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ActivepiecesService } from './activepieces.service';
import {
	CreateActivepiecesIntegrationDto,
	SetupActivepiecesIntegrationDto,
	ActivepiecesConnectionsListQueryDto,
	SetActivepiecesConnectionModeDto
} from './dto';
import {
	IActivepiecesConnection,
	IActivepiecesConnectionModeStatus,
	IActivepiecesConnectionsListResponse
} from '@gauzy/contracts';

/**
 * `TenantPermissionGuard` asks only whether ANY role of the tenant holds the permission a route states;
 * `PermissionGuard` is what asks it of the caller's own role. With the tenant guard alone, every
 * `@Permissions` below let any authenticated member of the tenant through (VIEWER, EMPLOYEE, CANDIDATE),
 * while the `INTEGRATION_*` grants belong to ADMIN and SUPER_ADMIN by default.
 */
@ApiTags('ActivePieces Integration')
@ApiBearerAuth()
// `TenantPermissionGuard` asks only whether some role of the tenant holds a permission; `PermissionGuard` is what
// checks the caller's own role against the `@Permissions` below, as the other integration controllers do.
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/integration/activepieces')
export class ActivepiecesController {
	private readonly logger = new Logger(ActivepiecesController.name);
	constructor(
		private readonly activepiecesService: ActivepiecesService
	) {}

	/**
	 * Set up ActivePieces integration with API key
	 */
	@ApiOperation({ summary: 'Set up ActivePieces integration with API key' })
	@ApiResponse({
		status: 201,
		description: 'Successfully set up ActivePieces integration'
	})
	@Post('/setup')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async setupIntegration(@Body() input: SetupActivepiecesIntegrationDto): Promise<{ integrationTenantId: string }> {
		try {
			return await this.activepiecesService.setupIntegration(
				input.apiKey,
				input.organizationId
			);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to set up ActivePieces integration', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to set up ActivePieces integration', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * How the tenant reaches Activepieces: the mode it chose, the mode in use, the modes available, its project.
	 */
	@ApiOperation({ summary: 'Get how the tenant reaches ActivePieces (connection mode)' })
	@ApiResponse({
		status: 200,
		description: 'The connection mode chosen and in use, the modes available and the pinned project. Never a key.'
	})
	@Get('/connection-mode')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getConnectionMode(@Query('organizationId') organizationId?: string): Promise<IActivepiecesConnectionModeStatus> {
		try {
			return await this.activepiecesService.getConnectionModeStatus(this.optionalId(organizationId));
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get ActivePieces connection mode', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get ActivePieces connection mode', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Chooses how the tenant reaches Activepieces: its own key, a project token, or the installation's key pinned to
	 * the tenant's own project, or `auto` (the first available, in that order).
	 */
	@ApiOperation({ summary: 'Choose how the tenant reaches ActivePieces (connection mode)' })
	@ApiResponse({ status: 201, description: 'The connection mode saved' })
	@ApiResponse({ status: 400, description: 'The mode is not available on this installation, or to this tenant' })
	@Post('/connection-mode')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async setConnectionMode(@Body() input: SetActivepiecesConnectionModeDto): Promise<IActivepiecesConnectionModeStatus> {
		try {
			return await this.activepiecesService.setConnectionMode(input.mode, input.organizationId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to set ActivePieces connection mode', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to set ActivePieces connection mode', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Connects the tenant's own Activepieces project now (project-token and platform-project modes), instead of at its
	 * first call, and answers its id.
	 */
	@ApiOperation({ summary: "Connect the tenant's own ActivePieces project" })
	@ApiResponse({ status: 201, description: 'The mode in use and the tenant project id (none with its own key)' })
	@Post('/project')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	async connectProject(
		@Query('organizationId') organizationId?: string
	): Promise<{ mode: string; projectId: string | null }> {
		try {
			return await this.activepiecesService.connectTenantProject(this.optionalId(organizationId));
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to connect the ActivePieces project', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to connect the ActivePieces project', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

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
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
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
	 * An optional id from the query: trimmed, absent when empty. Only ever matched against the tenant's own rows.
	 */
	private optionalId(value?: string): string | undefined {
		const trimmed = typeof value === 'string' ? value.trim() : '';
		return trimmed || undefined;
	}
}
