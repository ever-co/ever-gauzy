import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, HttpStatus, Param, Patch, Query, UseGuards, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ValidationPipe } from '@nestjs/common';
import { InstallPluginCommand } from '../../application/commands/install-plugin.command';
import { UninstallPluginCommand } from '../../application/commands/uninstall-plugin.command';
import { InstallPluginDTO } from '../../shared/dto/install-plugin.dto';
import { PluginSubscriptionGuard } from '../guards';

@ApiTags('Plugin Installation')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId')
export class PluginInstallationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({
		summary: 'Install a plugin with a specific version',
		description: 'Installs a plugin for the current tenant. Requires a valid subscription for the plugin.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiQuery({
		name: 'versionId',
		description: 'Unique identifier of the version to install',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin installed successfully'
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
	@Patch('install')
	public async install(
		@Param('pluginId', UUIDValidationPipe) id: ID,
		@Query() query: InstallPluginDTO
	): Promise<void> {
		await this.commandBus.execute(new InstallPluginCommand(id, query));
	}

	@ApiOperation({ summary: 'Uninstall a plugin' })
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@Permissions(PermissionsEnum.PLUGIN_UNINSTALL)
	@Patch('uninstall')
	public async uninstall(@Param('pluginId', UUIDValidationPipe) id: ID): Promise<void> {
		await this.commandBus.execute(new UninstallPluginCommand(id));
	}
}
