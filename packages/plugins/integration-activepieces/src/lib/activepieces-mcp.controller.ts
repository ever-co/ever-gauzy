import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	Query,
	HttpException,
	HttpStatus,
	Patch,
	Delete,
	UsePipes,
	ValidationPipe,
	Logger,
	HttpCode
} from '@nestjs/common';
import { ListMcpServersDto, ActivepiecesMcpCreateDto, ActivepiecesMcpUpdateDto, McpServerProjectQueryDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, Permissions } from '@gauzy/core';
import { UseGuards } from '@nestjs/common';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServerPublic,
	IActivepiecesMcpServersListResponsePublic
} from '@gauzy/contracts';

/** The `projectId` query of the routes that name a server. */
const PROJECT_QUERY_DESCRIPTION =
	"ActivePieces project ID of the server (MCP 2.0: required with the tenant's own key; the tenant's own project is used when the server pins one)";

/**
 * The tenant's Activepieces MCP server. Activepieces MCP 2.0 (the default; `GAUZY_ACTIVEPIECES_MCP_API=legacy` keeps
 * the routes before it) has one server per project: the routes that name a server read the project's and answer 404
 * for any other id; `projectId` (query) names the project with the tenant's own key. MCP accepts only user tokens:
 * in the `platform_project` mode, or with a tenant's own API key, every route answers 400 with an explanation.
 *
 * `TenantPermissionGuard` asks only whether ANY role of the tenant holds the permission a route states;
 * `PermissionGuard` is what asks it of the caller's own role. With the tenant guard alone, every
 * `@Permissions` below let any authenticated member of the tenant through (VIEWER, EMPLOYEE, CANDIDATE),
 * while the `INTEGRATION_*` grants belong to ADMIN and SUPER_ADMIN by default.
 */
@ApiTags('ActivePieces MCP Server Integration')
// `TenantPermissionGuard` asks only whether some role of the tenant holds a permission; `PermissionGuard` is what
// checks the caller's own role against the `@Permissions` below, as the other integration controllers do.
@UseGuards(TenantPermissionGuard, PermissionGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('/integration/activepieces/mcp')
export class ActivepiecesMcpController {
	private readonly logger = new Logger(ActivepiecesMcpController.name);
	constructor(private readonly activepiecesMcpService: ActivepiecesMcpService) {}

	/**
	 * Remove sensitive token field from MCP server object
	 */
	private sanitizeMcpServer(server: IActivepiecesMcpServer): IActivepiecesMcpServerPublic {
		const { token, ...publicServer } = server;
		return publicServer;
	}

	/**
	 * Validate and trim ID parameter
	 */
	private validateAndTrimId(paramName: string, value?: string): string {
		const trimmed = value?.trim();
		if (!trimmed) {
			throw new HttpException(`${paramName} is required`, HttpStatus.BAD_REQUEST);
		}
		return trimmed;
	}

	/**
	 * Handle errors consistently across all controller methods
	 */
	private handleError(publicMessage: string, error: any, fallbackStatus = HttpStatus.INTERNAL_SERVER_ERROR): never {
		if (error instanceof HttpException) throw error;

		const status = error?.status || fallbackStatus;
		this.logger.error(`${publicMessage}: ${error?.message}`, error?.stack);
		throw new HttpException(publicMessage, status);
	}

	/**
	 * List MCP servers for a project
	 */
	@ApiOperation({ summary: 'List ActivePieces MCP servers for a project' })
	@ApiResponse({
		status: 200,
		description: 'Returns list of MCP servers',
		schema: {
			type: 'object',
			properties: {
				data: {
					type: 'array',
					items: { type: 'object' }
				},
				next: { type: 'string', nullable: true },
				previous: { type: 'string', nullable: true }
			}
		}
	})
	@Get()
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async listMcpServers(@Query() query: ListMcpServersDto): Promise<IActivepiecesMcpServersListResponsePublic> {
		try {
			const result = await this.activepiecesMcpService.listMcpServers(query);

			// Remove sensitive token field from each server
			return {
				data: result.data.map((server: IActivepiecesMcpServer) => this.sanitizeMcpServer(server)),
				next: result.next,
				previous: result.previous
			};
		} catch (error: any) {
			this.handleError('Failed to list ActivePieces MCP servers', error);
		}
	}

	/**
	 * Create MCP server (legacy MCP API only: under MCP 2.0 a project has exactly one server, and this answers 400)
	 */
	@ApiOperation({ summary: 'Create ActivePieces MCP server (legacy MCP API only)' })
	@ApiQuery({ name: 'projectId', required: false, type: String, description: PROJECT_QUERY_DESCRIPTION })
	@ApiResponse({
		status: 201,
		description: 'Returns the created MCP server (token is not returned)',
		schema: { type: 'object' }
	})
	@ApiResponse({ status: 400, description: 'MCP 2.0 (one server per project), or an invalid body' })
	@Post()
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	async createMcpServer(
		@Body() data: ActivepiecesMcpCreateDto,
		@Query() { projectId }: McpServerProjectQueryDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const server = await this.activepiecesMcpService.createMcpServer(data, projectId);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to create ActivePieces MCP server', error);
		}
	}

	/**
	 * Get MCP servers for current tenant
	 */
	@ApiOperation({ summary: 'Get ActivePieces MCP servers for current tenant' })
	@ApiQuery({
		name: 'projectId',
		required: false,
		type: String,
		description: "ActivePieces project ID (the tenant's own project is used when the server pins one)"
	})
	@ApiResponse({
		status: 200,
		description: 'Returns tenant MCP servers',
		schema: {
			type: 'array',
			items: { type: 'object' }
		}
	})
	@Get('/tenant')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getTenantMcpServers(@Query() { projectId }: ListMcpServersDto): Promise<IActivepiecesMcpServerPublic[]> {
		try {
			const servers = await this.activepiecesMcpService.getTenantMcpServers(projectId);
			return servers.map((server) => this.sanitizeMcpServer(server));
		} catch (error: any) {
			this.handleError('Failed to get tenant ActivePieces MCP servers', error);
		}
	}

	/**
	 * Get MCP server by ID
	 */
	@ApiOperation({ summary: 'Get ActivePieces MCP server by ID' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiQuery({ name: 'projectId', required: false, type: String, description: PROJECT_QUERY_DESCRIPTION })
	@ApiResponse({
		status: 200,
		description: 'Returns MCP server details',
		schema: { type: 'object' }
	})
	@Get('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getMcpServer(
		@Param('serverId') serverId: string,
		@Query() { projectId }: McpServerProjectQueryDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.getMcpServer(id, projectId);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to get ActivePieces MCP server', error);
		}
	}

	/**
	 * Update MCP server
	 */
	@ApiOperation({ summary: 'Update ActivePieces MCP server (MCP 2.0: its disabledTools)' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiQuery({ name: 'projectId', required: false, type: String, description: PROJECT_QUERY_DESCRIPTION })
	@ApiResponse({
		status: 200,
		description: 'Returns updated MCP server',
		schema: { type: 'object' }
	})
	@Patch('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateMcpServer(
		@Param('serverId') serverId: string,
		@Body() updateData: ActivepiecesMcpUpdateDto,
		@Query() { projectId }: McpServerProjectQueryDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.updateMcpServer(id, updateData, projectId);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to update ActivePieces MCP server', error);
		}
	}

	/**
	 * Rotate MCP server token
	 */
	@ApiOperation({ summary: 'Rotate ActivePieces MCP server token' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiQuery({ name: 'projectId', required: false, type: String, description: PROJECT_QUERY_DESCRIPTION })
	@ApiResponse({
		status: 200,
		description: 'Returns MCP server (token is not returned)',
		schema: { type: 'object' }
	})
	@HttpCode(HttpStatus.OK)
	@Post('/:serverId/rotate')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async rotateMcpServerToken(
		@Param('serverId') serverId: string,
		@Query() { projectId }: McpServerProjectQueryDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.rotateMcpServerToken(id, projectId);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to rotate ActivePieces MCP server token', error);
		}
	}

	/**
	 * Delete MCP server (legacy MCP API only: under MCP 2.0 a project's one server cannot be deleted, and this answers 400)
	 */
	@ApiOperation({ summary: 'Delete ActivePieces MCP server (legacy MCP API only)' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiResponse({ status: 200, description: 'MCP server deleted' })
	@ApiResponse({ status: 400, description: "MCP 2.0 (the project's one server cannot be deleted)" })
	@Delete('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	async deleteMcpServer(@Param('serverId') serverId: string): Promise<void> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			await this.activepiecesMcpService.deleteMcpServer(id);
		} catch (error: any) {
			this.handleError('Failed to delete ActivePieces MCP server', error);
		}
	}
}
