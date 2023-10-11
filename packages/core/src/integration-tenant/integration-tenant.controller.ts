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
import { IntegrationTenantQueryDTO } from './dto';

@ApiTags('IntegrationTenant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationTenantController {
	constructor(
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Retrieve an integration tenant by specified options.
	 *
	 * @param options - The input options for finding the integration tenant.
	 * @returns The integration tenant if found, or `false` if not found or an error occurs.
	 */
	@ApiOperation({
		summary: 'Retrieve an integration tenant by specified options.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get()
	async getIntegrationByOptions(
		@Query() options: IntegrationTenantQueryDTO
	): Promise<IIntegrationTenant | boolean> {
		return await this._integrationTenantService.getIntegrationByOptions(options);
	}

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
		@Param('id', UUIDValidationPipe) integrationId: IIntegrationTenant['id'],
		@Query() query: RelationsQueryDTO
	): Promise<IIntegrationTenant> {
		return await this._integrationTenantService.findOneByIdString(integrationId, {
			relations: query.relations
		});
	}
}
