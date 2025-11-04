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
	UsePipes,
	ValidationPipe,
	Logger,
	HttpCode
} from '@nestjs/common';
import { ListMcpServersDto, ActivepiecesMcpUpdateDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { TenantPermissionGuard, Permissions } from '@gauzy/core';
import { UseGuards } from '@nestjs/common';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServerPublic,
	IActivepiecesMcpServersListResponsePublic
} from '@gauzy/contracts';

@ApiTags('ActivePieces MCP Server Integration')
@UseGuards(TenantPermissionGuard)
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
	 * Get MCP servers for current tenant
	 */
	@ApiOperation({ summary: 'Get ActivePieces MCP servers for current tenant' })
	@ApiQuery({ name: 'projectId', required: true, type: String, description: 'ActivePieces project ID' })
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
	@ApiResponse({
		status: 200,
		description: 'Returns MCP server details',
		schema: { type: 'object' }
	})
	@Get('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getMcpServer(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.getMcpServer(id);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to get ActivePieces MCP server', error);
		}
	}

	/**
	 * Update MCP server
	 */
	@ApiOperation({ summary: 'Update ActivePieces MCP server' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiResponse({
		status: 200,
		description: 'Returns updated MCP server',
		schema: { type: 'object' }
	})
	@Patch('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateMcpServer(
		@Param('serverId') serverId: string,
		@Body() updateData: ActivepiecesMcpUpdateDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.updateMcpServer(id, updateData);
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
	@ApiResponse({
		status: 200,
		description: 'Returns MCP server (token is not returned)',
		schema: { type: 'object' }
	})
	@HttpCode(HttpStatus.OK)
	@Post('/:serverId/rotate')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async rotateMcpServerToken(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = this.validateAndTrimId('Server ID', serverId);

			const server = await this.activepiecesMcpService.rotateMcpServerToken(id);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			this.handleError('Failed to rotate ActivePieces MCP server token', error);
		}
	}
}
