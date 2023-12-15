import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards,
	UsePipes,
	ValidationPipe,
	InternalServerErrorException,
	Put,
	Body,
	Delete,
	HttpException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { IIntegrationTenant, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from 'core/crud';
import { TenantOrganizationBaseDTO } from 'core/dto';
import { UUIDValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { RelationsQueryDTO } from './../shared/dto';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenantQueryDTO, UpdateIntegrationTenantDTO } from './dto';
import { IntegrationTenantDeleteCommand, IntegrationTenantUpdateCommand } from './commands';

@ApiTags('IntegrationTenant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationTenantController extends CrudController<IntegrationTenant> {
	constructor(
		private readonly _commandBus: CommandBus,
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
	 * Fetches an IntegrationTenant entity by ID from the database.
	 *
	 * @param integrationId - The ID of the IntegrationTenant entity (validated by UUIDValidationPipe).
	 * @param query - Optional query parameters, such as relations.
	 * @returns {Promise<IIntegrationTenant>} The fetched IntegrationTenant entity.
	 * @throws {InternalServerErrorException} If an error occurs during the fetching process.
	 */
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) integrationId: IIntegrationTenant['id'],
		@Query() query: RelationsQueryDTO
	): Promise<IIntegrationTenant> {
		try {
			const { relations } = query;

			// Attempt to find the IntegrationTenant entity in the database
			return await this._integrationTenantService.findOneByIdString(integrationId, { relations });
		} catch (error) {
			// Handle and log any errors that occur
			console.error(`Error while finding IntegrationTenant: ${error.message}`);

			// Throw an InternalServerErrorException with a generic error message
			throw new InternalServerErrorException('An error occurred while fetching the IntegrationTenant entity');
		}
	}

	/**
	 * Update an integration tenant with the provided data.
	 *
	 * @param id - The identifier of the integration tenant to update.
	 * @param input - The data to update the integration tenant with.
	 * @returns A response, typically the updated integration tenant or an error response.
	 */
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: IIntegrationTenant['id'],
		@Body() input: UpdateIntegrationTenantDTO
	): Promise<IIntegrationTenant> {
		try {
			// Update the corresponding integration tenant with the new input data
			return await this._commandBus.execute(
				new IntegrationTenantUpdateCommand(id, input)
			);
		} catch (error) {
			// Handle errors, e.g., return an error response.
			throw new Error('Failed to update integration fields');
		}
	}

	/**
	 * Delete a resource identified by the provided 'id'.
	 *
	 * @param {string} id - The identifier of the resource to be deleted.
	 * @returns {Promise<DeleteResult>} A Promise that resolves with the DeleteResult indicating the result of the deletion.
	 */
	@Delete(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async delete(
		@Param('id', UUIDValidationPipe) id: IIntegrationTenant['id'],
		@Query() query: TenantOrganizationBaseDTO,
	): Promise<DeleteResult> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.organizationId) {
				throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
			}

			// Execute a command to delete the resource using a command bus
			return await this._commandBus.execute(
				new IntegrationTenantDeleteCommand(id, query)
			);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Error while deleting integration: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
