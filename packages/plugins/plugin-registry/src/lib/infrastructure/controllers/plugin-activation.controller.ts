import { HttpStatus, ID } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PluginOwnerGuard } from '../../core/guards/plugin-owner.guard';
import { ActivatePluginCommand } from '../../application/commands/activate-plugin.command';
import { DeactivatePluginCommand } from '../../application/commands/deactivate-plugin.command';

@ApiTags('Plugin Activation')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId')
export class PluginActivationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'Activate plugin' })
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to activate',
		required: true
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Plugin activated successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plugin record not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to activate this plugin.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@UseGuards(PluginOwnerGuard)
	@Patch('activate')
	public async activate(@Param('pluginId', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new ActivatePluginCommand(id));
	}

	@ApiOperation({ summary: 'Deactivate plugin' })
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to deactivate',
		required: true
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Plugin deactivated successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plugin record not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to deactivate this plugin.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@UseGuards(PluginOwnerGuard)
	@Patch('deactivate')
	public async deactivate(@Param('pluginId', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new DeactivatePluginCommand(id));
	}
}
