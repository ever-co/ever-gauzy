import { Body, Controller, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IIntegrationAICreateInput, IIntegrationTenant, IIntegrationTenantUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UUIDValidationPipe } from '../../shared/pipes';
import { IntegrationAIService } from './integration-ai.service';

@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationAIController {

	constructor(
		private readonly _integrationAIService: IntegrationAIService
	) { }

	/**
	 *
	 * @param input
	 * @returns
	 */
	@Post()
	async create(
		@Body() input: IIntegrationAICreateInput
	): Promise<IIntegrationTenant> {
		return await this._integrationAIService.create(input);
	}

	/**
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Update i4net AI integration.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update i4net AI integration',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: IIntegrationTenant['id'],
		@Body() input: IIntegrationTenantUpdateInput
	) {
		return await this._integrationAIService.update(id, input);
	}
}
