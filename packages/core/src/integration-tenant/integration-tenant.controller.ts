import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards,
	UsePipes,
	ValidationPipe,
	InternalServerErrorException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IIntegrationTenant, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from 'core/crud';
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
export class IntegrationTenantController extends CrudController<IntegrationTenant> {
	constructor(
		private readonly _integrationTenantService: IntegrationTenantService
	) {
		super(_integrationTenantService);
	}

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
	@Get('integration')
	async getIntegrationByOptions(
		@Query() options: IntegrationTenantQueryDTO
	): Promise<IIntegrationTenant | boolean> {
		return await this._integrationTenantService.getIntegrationByOptions(options);
	}

	/**
	 * Fetch a paginated list of IntegrationTenant entities.
	 * @param params - Query parameters for pagination and filtering.
	 * @returns A paginated list of IntegrationTenant entities.
	 */
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<IntegrationTenant>
	): Promise<IPagination<IntegrationTenant>> {
		// Delegate the logic to your service
		return await this._integrationTenantService.findAll(params);
	}

	/**
	 * Fetch an IntegrationTenant entity in the database
	 *
	 * @param integrationId
	 * @param query
	 * @returns
	 */
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) integrationId: IIntegrationTenant['id'],
		@Query() query: RelationsQueryDTO
	): Promise<IIntegrationTenant> {
		try {
			// Attempt to find the IntegrationTenant entity in the database
			return await this._integrationTenantService.findOneByIdString(integrationId, {
				relations: query.relations,
			});
		} catch (error) {
			// Handle and log any errors that occur
			console.error(`Error while finding IntegrationTenant: ${error.message}`);

			// Throw an InternalServerErrorException with a generic error message
			throw new InternalServerErrorException('An error occurred while fetching the IntegrationTenant entity');
		}
	}
}
