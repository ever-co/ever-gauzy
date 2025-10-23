import { HttpStatus, ID } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ActivatePluginCommand } from '../../application/commands/activate-plugin.command';
import { DeactivatePluginCommand } from '../../application/commands/deactivate-plugin.command';
import { PluginAccessGuard } from '../../core/guards/plugin-access.guard';

// DTO for status update
export class UpdateInstallationStatusDTO {
	status: 'active' | 'inactive';
}

@ApiTags('Plugin Installation Management')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId/installations')
export class PluginActivationController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({
		summary: 'Update plugin installation status',
		description: 'Activate or deactivate a plugin installation by updating its status'
	})
	@ApiParam({
		name: 'pluginId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin',
		required: true
	})
	@ApiParam({
		name: 'installationId',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin installation',
		required: true
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['active', 'inactive'],
					description: 'New status for the installation'
				}
			},
			required: ['status']
		}
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Plugin installation status updated successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plugin installation not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to modify this plugin installation.'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
	@UseValidationPipe({ whitelist: true, transform: true })
	@UseGuards(PluginAccessGuard)
	@Patch(':installationId')
	public async updateStatus(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('installationId', UUIDValidationPipe) installationId: ID,
		@Body() updateStatusDto: UpdateInstallationStatusDTO
	): Promise<void> {
		if (updateStatusDto.status === 'active') {
			return this.commandBus.execute(new ActivatePluginCommand(installationId));
		} else {
			return this.commandBus.execute(new DeactivatePluginCommand(installationId));
		}
	}
}
