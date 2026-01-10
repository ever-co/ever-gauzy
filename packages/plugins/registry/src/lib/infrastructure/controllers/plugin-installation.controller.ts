import { ID, IPluginInstallation, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Delete, HttpStatus, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InstallPluginCommand, UninstallPluginCommand } from '../../application';
import { PluginSubscriptionGuard } from '../../core';
import { InstallPluginDTO } from '../../shared';

@ApiTags('Plugin Installation')
@Controller('/plugins/:pluginId/installations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class PluginInstallationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({
		summary: 'Install a plugin with a specific version',
		description:
			'Creates a new plugin installation for the current tenant. Requires a valid subscription for the plugin.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin installation created successfully'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Valid subscription required or insufficient permissions'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid plugin ID or version ID'
	})
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	@UseGuards(PluginSubscriptionGuard)
	@Permissions(PermissionsEnum.PLUGIN_INSTALL)
	@Post()
	public async create(
		@Param('pluginId', UUIDValidationPipe) id: ID,
		@Body() body: InstallPluginDTO
	): Promise<IPluginInstallation> {
		return this.commandBus.execute(new InstallPluginCommand(id, body));
	}

	@ApiOperation({
		summary: 'Uninstall a plugin',
		description: 'Removes a plugin installation by ID'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'installationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin installation removed successfully'
	})
	@Permissions(PermissionsEnum.PLUGIN_UNINSTALL)
	@Delete(':installationId')
	public async remove(@Param('installationId', UUIDValidationPipe) installationId: ID) {
		await this.commandBus.execute(new UninstallPluginCommand(installationId));
		return { message: 'Plugin installation removed successfully', statusCode: HttpStatus.NO_CONTENT };
	}
}
