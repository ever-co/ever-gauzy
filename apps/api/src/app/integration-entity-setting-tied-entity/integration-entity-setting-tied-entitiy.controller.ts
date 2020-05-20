import {
	Controller,
	HttpStatus,
	Param,
	Put,
	Body,
	UseGuards
} from '@nestjs/common';
import { CrudController } from '../core';

import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entitiy.entity';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entitiy.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class IntegrationEntitySettingTiedEntityController extends CrudController<
	IntegrationEntitySettingTiedEntity
> {
	constructor(
		private integrationEntitySettingTiedEntityService: IntegrationEntitySettingTiedEntityService
	) {
		super(integrationEntitySettingTiedEntityService);
	}

	@ApiOperation({ summary: 'Update settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update settings',
		type: IntegrationEntitySettingTiedEntity
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put(':integrationId')
	async editSettings(
		@Param('integrationId') integrationId,
		@Body() editSettingsDto
	): Promise<IntegrationEntitySettingTiedEntity> {
		return await this.integrationEntitySettingTiedEntityService.create(
			editSettingsDto
		);
	}
}
