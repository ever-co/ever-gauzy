import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IIntegrationTenant } from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';

@ApiTags('IntegrationTenant')
@UseGuards(TenantPermissionGuard)
@Controller()
export class IntegrationTenantController {
	constructor(
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	@ApiOperation({ summary: 'Find tntegration tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found integration tenant',
		type: IntegrationTenant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IIntegrationTenant> {
		const { relations } = data;
		return this._integrationTenantService.findOne(id, {
			relations
		});
	}
}
