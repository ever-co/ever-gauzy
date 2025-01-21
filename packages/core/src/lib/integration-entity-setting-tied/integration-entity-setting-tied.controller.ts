import { Controller, HttpStatus, Param, Put, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationEntitySettingTied, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
import { IntegrationEntitySettingTiedUpdateCommand } from './commands';

@ApiTags('IntegrationEntitySettingTied')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration-entity-setting-tied')
export class IntegrationEntitySettingTiedController {
	constructor(private readonly _commandBus: CommandBus) {}

	/**
	 *
	 * @param integrationId
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update settings',
		type: IntegrationEntitySettingTied
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put('integration/:id')
	async updateIntegrationEntitySettingTiedByIntegration(
		@Param('id', UUIDValidationPipe) integrationId: string,
		@Body() entity
	): Promise<IIntegrationEntitySettingTied> {
		return await this._commandBus.execute(new IntegrationEntitySettingTiedUpdateCommand(integrationId, entity));
	}
}
