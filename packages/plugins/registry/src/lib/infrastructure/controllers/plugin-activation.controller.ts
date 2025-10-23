import { HttpStatus, ID } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ActivatePluginCommand } from '../../application/commands/activate-plugin.command';
import { DeactivatePluginCommand } from '../../application/commands/deactivate-plugin.command';
import { PluginAccessGuard } from '../../core/guards/plugin-access.guard';

@ApiTags('Plugin Installation Activation')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugin-installations/:installationId')
export class PluginActivationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'Activate plugin installation' })
	@ApiParam({
		name: 'installationId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin installation to activate',
		required: true
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Plugin installation activated successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plugin installation not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to activate this plugin installation.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@UseGuards(PluginAccessGuard)
	@Patch('activate')
	public async activate(@Param('installationId', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new ActivatePluginCommand(id));
	}

	@ApiOperation({ summary: 'Deactivate plugin installation' })
	@ApiParam({
		name: 'installationId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin installation to deactivate',
		required: true
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Plugin installation deactivated successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plugin installation not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to deactivate this plugin installation.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@UseGuards(PluginAccessGuard)
	@Patch('deactivate')
	public async deactivate(@Param('installationId', UUIDValidationPipe) id: ID): Promise<void> {
		return this.commandBus.execute(new DeactivatePluginCommand(id));
	}
}
