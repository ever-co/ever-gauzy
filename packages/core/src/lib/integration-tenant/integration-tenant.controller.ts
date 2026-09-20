import {
	Controller,
	ForbiddenException,
	HttpCode,
	HttpStatus,
	Get,
	Query,
	Param,
	Post,
	UseGuards,
	InternalServerErrorException,
	Put,
	Body,
	Delete,
	HttpException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IIntegrationTenant, IIntegrationTenantCreateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { RelationsQueryDTO } from './../shared/dto';
import { isUserEditableIntegrationSetting } from './../integration-setting/integration-setting.utils';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenantQueryDTO, UpdateIntegrationTenantDTO } from './dto';
import { IntegrationTenantDeleteCommand, IntegrationTenantUpdateCommand } from './commands';

@ApiTags('IntegrationTenant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration-tenant')
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
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/integration')
	@UseValidationPipe()
	async getIntegrationByOptions(@Query() options: IntegrationTenantQueryDTO): Promise<IIntegrationTenant | boolean> {
		return await this._integrationTenantService.getIntegrationByOptions(options);
	}

	/**
	 * Fetch a paginated list of IntegrationTenant entities.
	 * @param params - Query parameters for pagination and filtering.
	 * @returns A paginated list of IntegrationTenant entities.
	 */
	@Get('/')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<IntegrationTenant>): Promise<IPagination<IntegrationTenant>> {
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
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) integrationId: ID,
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
			throw new InternalServerErrorException('An error occurred while fetching the integration entity');
		}
	}

	/**
	 * Create an integration tenant.
	 *
	 * Overrides `CrudController.create()`, which accepted the raw body: `IntegrationTenantService`
	 * cascade-inserts whatever `settings` the body carries, and those settings are exactly the
	 * values the server TRUSTS afterwards — GitHub's `installation_id`, OAuth access and refresh
	 * tokens, account / workspace / instance ids. That made this inherited route a second way to
	 * bind another tenant's GitHub App installation, skipping the install flow's state nonce and
	 * its cross-tenant uniqueness check exactly as the generic `PUT /integration-setting/:id` did
	 * (GHSA-4rwq-65wh-45h4). Integrations write their own settings server-side (through
	 * `IntegrationTenantUpdateOrCreateCommand`), so a client may only bring settings that are on
	 * the user-editable allowlist.
	 *
	 * @param input - The integration tenant to create.
	 * @returns The created integration tenant.
	 */
	@ApiOperation({ summary: 'Create an integration tenant.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The integration tenant has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The setting is managed by the server and cannot be set by a client'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	async create(@Body() input: IIntegrationTenantCreateInput): Promise<IIntegrationTenant> {
		// Fail closed: anything under `settings` that is not a plain array of allowlisted settings is refused.
		const submitted = input?.settings;

		if (submitted != null && !Array.isArray(submitted)) {
			throw new ForbiddenException(
				'This integration setting is managed by the server and cannot be set by a client.'
			);
		}

		for (const setting of submitted ?? []) {
			if (!isUserEditableIntegrationSetting(input?.name, setting?.settingsName)) {
				throw new ForbiddenException(
					'This integration setting is managed by the server and cannot be set by a client.'
				);
			}
		}

		return await this._integrationTenantService.create(input);
	}

	/**
	 * Update an integration tenant with the provided data.
	 *
	 * @param id - The identifier of the integration tenant to update.
	 * @param input - The data to update the integration tenant with.
	 * @returns A response, typically the updated integration tenant or an error response.
	 */
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateIntegrationTenantDTO
	): Promise<IIntegrationTenant> {
		// Update the corresponding integration tenant with the new input data
		return await this._commandBus.execute(new IntegrationTenantUpdateCommand(id, input));
	}

	/**
	 * Delete a resource identified by the provided 'id'.
	 *
	 * @param {string} id - The identifier of the resource to be deleted.
	 * @returns {Promise<DeleteResult>} A Promise that resolves with the DeleteResult indicating the result of the deletion.
	 */
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@Delete('/:id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: TenantOrganizationBaseDTO
	): Promise<DeleteResult> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.organizationId) {
				throw new HttpException(
					'Missing or invalid organizationId in the query parameters',
					HttpStatus.BAD_REQUEST
				);
			}

			// Execute a command to delete the resource using a command bus
			return await this._commandBus.execute(new IntegrationTenantDeleteCommand(id, query));
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Error while deleting integration: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
