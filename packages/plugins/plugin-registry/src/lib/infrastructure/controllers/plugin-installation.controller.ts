import { ID } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Param, Patch, Query, UseGuards, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ValidationPipe } from '@nestjs/common';
import { InstallPluginCommand } from '../../application/commands/install-plugin.command';
import { UninstallPluginCommand } from '../../application/commands/uninstall-plugin.command';
import { InstallPluginDTO } from '../../shared/dto/install-plugin.dto';

@ApiTags('Plugin Installation')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId')
export class PluginInstallationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'Install a plugin with a specific version' })
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
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
	@Patch('uninstall')
	public async uninstall(@Param('pluginId', UUIDValidationPipe) id: ID): Promise<void> {
		await this.commandBus.execute(new UninstallPluginCommand(id));
	}
}
