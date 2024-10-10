import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards, Put, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindOptionsWhere } from 'typeorm';
import { ID, IOrganization, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './commands';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDTO, OrganizationFindOptionsDTO, UpdateOrganizationDTO } from './dto';

@ApiTags('Organization')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/organization')
export class OrganizationController extends CrudController<Organization> {
	constructor(private readonly organizationService: OrganizationService, private readonly commandBus: CommandBus) {
		super(organizationService);
	}

	/**
	 * GET organization count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get('/count')
	async getCount(@Query() options: FindOptionsWhere<Organization>): Promise<number> {
		return await this.organizationService.countBy(options);
	}

	/**
	 * GET organization pagination
	 *
	 * Retrieve a paginated list of organizations within the tenant.
	 *
	 * @param options Query options for pagination and filtering
	 * @returns Paginated list of organizations
	 */
	@ApiOperation({ summary: 'Retrieve paginated list of organizations within the tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved paginated list of organizations.',
		type: Organization,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No organizations found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: OrganizationFindOptionsDTO<Organization>): Promise<IPagination<IOrganization>> {
		return await this.organizationService.paginate(options);
	}

	/**
	 * GET organizations by find many conditions
	 *
	 * Find all organizations within the tenant, optionally applying filters.
	 *
	 * @param options Query options for filtering organizations
	 * @returns A list of organizations based on the applied filters
	 */
	@ApiOperation({ summary: 'Find all organizations within the tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved organizations.',
		type: Organization,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No organizations found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(@Query() options: OrganizationFindOptionsDTO<Organization>): Promise<IPagination<IOrganization>> {
		return await this.organizationService.findAll(options);
	}

	/**
	 * GET organization by id
	 *
	 * Find an organization by its ID within the tenant.
	 *
	 * @param id The unique ID of the organization
	 * @param options Query options for additional filtering
	 * @returns The organization that matches the ID
	 */
	@ApiOperation({ summary: 'Find Organization by ID within the tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the organization.',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No organization found with the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		description: 'The unique identifier (UUID) of the organization.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: OrganizationFindOptionsDTO<Organization>
	): Promise<IOrganization> {
		return await this.organizationService.findOneByIdString(id, options);
	}

	/**
	 * CREATE organization for a specific tenant
	 *
	 * Creates a new organization within the tenant.
	 *
	 * @param entity The DTO containing organization details
	 * @returns The newly created organization
	 */
	@ApiOperation({ summary: 'Create a new Organization for a specific tenant' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The Organization has been successfully created.',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateOrganizationDTO): Promise<IOrganization> {
		return await this.commandBus.execute(new OrganizationCreateCommand(entity));
	}

	/**
	 * UPDATE organization by id
	 *
	 * Update an existing organization by its ID within the tenant.
	 *
	 * @param id The unique ID of the organization
	 * @param entity The DTO containing updated organization details
	 * @returns The updated organization
	 */
	@ApiOperation({ summary: 'Update an existing Organization' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The Organization has been successfully updated.',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No organization found with the provided ID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		description: 'The unique identifier (UUID) of the organization.'
	})
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationDTO
	): Promise<IOrganization> {
		return await this.commandBus.execute(new OrganizationUpdateCommand(id, entity));
	}
}
