import { BadRequestException, Body, Controller, HttpException, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IIntegrationSetting, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { IntegrationSetting } from './integration-setting.entity';
import { IntegrationSettingService } from './integration-setting.service';
import { UpdateIntegrationSettingDTO } from './dto/update-integration-setting.dto';

@ApiTags('IntegrationSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration-setting')
export class IntegrationSettingController {
	constructor(private readonly integrationSettingService: IntegrationSettingService) {}

	/**
	 * Update integration setting.
	 *
	 * @param id - The ID of the integration setting to update.
	 * @param input - The updated integration setting data.
	 * @returns A Promise that resolves to the updated integration setting.
	 */
	@ApiOperation({ summary: 'Update integration setting.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update integration setting',
		type: IntegrationSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The setting is managed by the server and cannot be changed'
	})
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateIntegrationSettingDTO
	): Promise<IIntegrationSetting> {
		try {
			// Tenant-scoped, allowlisted, value-only update: see IntegrationSettingService.updateEditableSetting
			// (GHSA-4rwq-65wh-45h4).
			return await this.integrationSettingService.updateEditableSetting(id, input);
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(error);
		}
	}
}
