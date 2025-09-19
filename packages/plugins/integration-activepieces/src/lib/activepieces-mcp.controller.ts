import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { ListMcpServersDto, ActivepiecesMcpUpdateDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { TenantPermissionGuard, Permissions } from '@gauzy/core';
import { UseGuards } from '@nestjs/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServerPublic,
	IActivepiecesMcpServersListResponsePublic
} from './activepieces.type';

@ApiTags('ActivePieces MCP Server Integration')
@UseGuards(TenantPermissionGuard)
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
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async listMcpServers(@Query() query: ListMcpServersDto): Promise<IActivepiecesMcpServersListResponsePublic> {
		try {
			const result = await this.activepiecesMcpService.listMcpServers(query);

			// Remove sensitive token field from each server
			return {
				data: result.data.map(server => this.sanitizeMcpServer(server)),
				next: result.next,
				previous: result.previous
			};
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			this.logger.error('Failed to list ActivePieces MCP servers', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to list ActivePieces MCP servers', error?.status || HttpStatus.INTERNAL_SERVER_ERROR);
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
	async getTenantMcpServers(@Query() { projectId }: ListMcpServersDto): Promise<IActivepiecesMcpServerPublic[]> {
		try {
			const servers = await this.activepiecesMcpService.getTenantMcpServers(projectId);
			return servers.map(server => this.sanitizeMcpServer(server));
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			this.logger.error('Failed to get tenant ActivePieces MCP servers', { message: error?.message, stack: error?.stack });
			throw new HttpException(
				'Failed to get tenant ActivePieces MCP servers',
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
	async getMcpServer(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = serverId?.trim();
            if (!id) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			const server = await this.activepiecesMcpService.getMcpServer(id);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			this.logger.error('Failed to get ActivePieces MCP server', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get ActivePieces MCP server', error?.status || HttpStatus.INTERNAL_SERVER_ERROR);
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
		@Body() updateData: ActivepiecesMcpUpdateDto
	): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = serverId?.trim();
            if (!id) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			const server = await this.activepiecesMcpService.updateMcpServer(id, updateData);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			this.logger.error('Failed to update ActivePieces MCP server', { message: error?.message, stack: error?.stack });
			throw new HttpException(
				'Failed to update ActivePieces MCP server',
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
	async rotateMcpServerToken(@Param('serverId') serverId: string): Promise<IActivepiecesMcpServerPublic> {
		try {
			const id = serverId?.trim();
            if (!id) {
				throw new HttpException('Server ID is required', HttpStatus.BAD_REQUEST);
			}

			const server = await this.activepiecesMcpService.rotateMcpServerToken(id);
			return this.sanitizeMcpServer(server);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			this.logger.error('Failed to rotate ActivePieces MCP server token', { message: error?.message, stack: error?.stack });
			throw new HttpException(
				'Failed to rotate ActivePieces MCP server token',
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
