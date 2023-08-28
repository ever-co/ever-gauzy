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
import { IIntegrationTenant, PermissionsEnum } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { RelationsQueryDTO } from './../shared/dto';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationRememberStateQueryDTO } from './dto';

@ApiTags('IntegrationTenant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationTenantController {
	constructor(
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Find integration tenant by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Find integration tenant.' })
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
		@Param('id', UUIDValidationPipe) id: IIntegrationTenant['id'],
		@Query() query: RelationsQueryDTO
	): Promise<IIntegrationTenant> {
		return await this._integrationTenantService.findOneByIdString(id, {
			relations: query.relations
		});
	}


	/**
	 * GET Check integration remember state for tenant user
	 *
	 * @param integration
	 * @param organizationId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Check integration remember state for tenant user.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Checked state'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('remember/state')
	async checkRememberState(
		@Query() query: IntegrationRememberStateQueryDTO
	): Promise<IIntegrationTenant | boolean> {
		return await this._integrationTenantService.checkIntegrationRememberState(query);
	}
}
