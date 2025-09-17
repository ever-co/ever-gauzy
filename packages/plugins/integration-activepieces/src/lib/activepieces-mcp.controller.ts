import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { TenantPermissionGuard, Permissions } from '@gauzy/core';
import { UseGuards } from '@nestjs/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesMcpServersListParams,
	IActivepiecesMcpServerUpdateRequest
} from './activepieces.type';

@ApiTags('ActivePieces MCP Server Integration')
@UseGuards(TenantPermissionGuard)
@Controller('/integration/activepieces/mcp')
export class ActivepiecesMcpController {
	constructor(private readonly activepiecesMcpService: ActivepiecesMcpService) {}

	/**
	 * List MCP servers for a project
	 */
	@ApiOperation({ summary: 'List ActivePieces MCP servers for a project' })
	@ApiQuery({ name: 'projectId', required: true, type: String, description: 'ActivePieces project ID' })
	@ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return' })
	@ApiQuery({ name: 'cursor', required: false, type: String, description: 'Pagination cursor' })
	@ApiQuery({ name: 'name', required: false, type: String, description: 'Filter by MCP server name' })
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
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async listMcpServers(@Query() query: IActivepiecesMcpServersListParams): Promise<IActivepiecesMcpServersListResponse> {
		try {
			if (!query.projectId) {
				throw new HttpException('Project ID is required', HttpStatus.BAD_REQUEST);
			}

			return await this.activepiecesMcpService.listMcpServers(query);
		} catch (error: any) {
			throw new HttpException(
				`Failed to list ${IntegrationEnum.ACTIVE_PIECES} MCP servers: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
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
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async getTenantMcpServers(@Query('projectId') projectId: string): Promise<IActivepiecesMcpServer[]> {
		try {
			if (!projectId) {
				throw new HttpException('Project ID is required', HttpStatus.BAD_REQUEST);
			}

			return await this.activepiecesMcpService.getTenantMcpServers(projectId);
		} catch (error: any) {
			throw new HttpException(
				`Failed to get tenant ${IntegrationEnum.ACTIVE_PIECES} MCP servers: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
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
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async getMcpServer(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			if (!serverId) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			return await this.activepiecesMcpService.getMcpServer(serverId);
		} catch (error: any) {
			throw new HttpException(
				`Failed to get ${IntegrationEnum.ACTIVE_PIECES} MCP server: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
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
	@Post('/:serverId')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async updateMcpServer(
		@Param('serverId') serverId: string,
		@Body() updateData: IActivepiecesMcpServerUpdateRequest
	): Promise<IActivepiecesMcpServer> {
		try {
			if (!serverId) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			return await this.activepiecesMcpService.updateMcpServer(serverId, updateData);
		} catch (error: any) {
			throw new HttpException(
				`Failed to update ${IntegrationEnum.ACTIVE_PIECES} MCP server: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Rotate MCP server token
	 */
	@ApiOperation({ summary: 'Rotate ActivePieces MCP server token' })
	@ApiParam({ name: 'serverId', required: true, type: String, description: 'MCP server ID' })
	@ApiResponse({
		status: 200,
		description: 'Returns MCP server with new token',
		schema: { type: 'object' }
	})
	@Post('/:serverId/rotate')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async rotateMcpServerToken(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			if (!serverId) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			return await this.activepiecesMcpService.rotateMcpServerToken(serverId);
		} catch (error: any) {
			throw new HttpException(
				`Failed to rotate ${IntegrationEnum.ACTIVE_PIECES} MCP server token: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
