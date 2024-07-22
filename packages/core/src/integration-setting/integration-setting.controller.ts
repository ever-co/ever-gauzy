import { BadRequestException, Body, Controller, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IIntegrationSetting, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { IntegrationSetting } from './integration-setting.entity';
import { IntegrationSettingService } from './integration-setting.service';
import { UpdateIntegrationSettingDTO } from './dto/update-integration-setting.dto';

@ApiTags('IntegrationSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller('integration-setting')
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
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IIntegrationSetting['id'],
		@Body() input: UpdateIntegrationSettingDTO
	): Promise<IIntegrationSetting> {
		try {
			await this.integrationSettingService.create({
				...input,
				id
			});
			return await this.integrationSettingService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
