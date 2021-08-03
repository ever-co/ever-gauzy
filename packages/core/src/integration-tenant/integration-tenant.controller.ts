import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CrudController } from '../core';
import { TenantPermissionGuard } from './../shared/guards';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';

@ApiTags('IntegrationTenant')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class IntegrationTenantController extends CrudController<IntegrationTenant> {
	constructor(private _integrationTenantService: IntegrationTenantService) {
		super(_integrationTenantService);
	}

	@ApiOperation({ summary: 'Find IntegrationTenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: IntegrationTenant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async getById(
		@Param('id', UUIDValidationPipe) id,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IntegrationTenant> {
		const { relations } = data;
		return this._integrationTenantService.findOne(id, {
			relations
		});
	}
}
