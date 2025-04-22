import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import {
	ID,
	IOrganizationProject,
	IOrganizationProjectEditByEmployeeInput,
	IOrganizationProjectSetting,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectEditByEmployeeCommand,
	OrganizationProjectSettingUpdateCommand,
	OrganizationProjectUpdateCommand
} from './commands';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectService } from './organization-project.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ProjectManagerOrPermissionGuard } from './guards/project-manager-or-permission.guard';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO, RelationsQueryDTO } from './../shared/dto';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from './../core/dto';
import {
	CreateOrganizationProjectDTO,
	UpdateOrganizationProjectDTO,
	UpdateProjectSettingDTO,
	UpdateTaskModeDTO
} from './dto';

@ApiTags('OrganizationProject')
@UseGuards(TenantPermissionGuard, ProjectManagerOrPermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
@Controller('/organization-projects')
export class OrganizationProjectController extends CrudController<OrganizationProject> {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly commandBus: CommandBus
	) {
		super(organizationProjectService);
	}

	/**
	 * GET organization projects by employee.
	 *
	 * @param employeeId - UUID of the employee.
	 * @param options - Additional filtering options based on tenant organization.
	 * @returns An array of organization projects associated with the employee.
	 */
	@ApiOperation({ summary: 'Find all organization projects by Employee.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		isArray: true,
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiParam({
		name: 'employeeId',
		description: 'UUID of the employee',
		type: String,
		required: true
	})
	@ApiQuery({
		name: 'options',
		description: 'Filtering options for tenant organization',
		type: TenantOrganizationBaseDTO,
		required: false
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@UseValidationPipe()
	@Get('/employee/:employeeId')
	async findProjectsByEmployee(
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query() options: TenantOrganizationBaseDTO
	): Promise<IOrganizationProject[]> {
		return await this.organizationProjectService.findByEmployee(employeeId, options);
	}

	/**
	 * Update organization project by employee.
	 *
	 * @param body - Payload for updating the organization project by employee.
	 * @returns A boolean indicating if the update was successful.
	 */
	@ApiOperation({ summary: 'Update organization project by employee' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@ApiBody({
		description: 'Payload for updating organization project by employee'
	})
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	@Put('/employee')
	async updateProjectByEmployee(@Body() body: IOrganizationProjectEditByEmployeeInput): Promise<boolean> {
		return await this.commandBus.execute(new OrganizationProjectEditByEmployeeCommand(body));
	}

	/**
	 * Update organization project task view mode.
	 *
	 * @param id - The UUID of the organization project to update.
	 * @param entity - Payload containing the new task view mode settings.
	 * @returns The updated organization project.
	 */
	@ApiOperation({ summary: 'Update organization project task view mode' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully updated.',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong'
	})
	@ApiParam({
		name: 'id',
		description: 'UUID of the organization project',
		type: String,
		required: true
	})
	@ApiBody({
		description: 'Payload for updating the task view mode',
		type: UpdateTaskModeDTO
	})
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	@UseValidationPipe({ whitelist: true })
	@Put('/task-view/:id')
	async updateTaskViewMode(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTaskModeDTO
	): Promise<IOrganizationProject> {
		return await this.commandBus.execute(new OrganizationProjectUpdateCommand(id, entity));
	}

	/**
	 * Update organization project settings by ID.
	 *
	 * @param id - The ID of the organization project to update settings for.
	 * @param entity - An object containing the updated project settings.
	 * @returns A promise that resolves to an `IOrganizationProjectSetting` object representing the updated project settings.
	 */
	@ApiOperation({ summary: 'Update organization project settings by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Organization project settings updated successfully'
	})
	@ApiParam({
		name: 'id',
		description: 'The ID of the organization project to update settings for',
		type: String,
		required: true
	})
	@ApiBody({
		description: 'Updated project settings payload',
		type: UpdateProjectSettingDTO
	})
	@UseValidationPipe({ whitelist: true })
	@Put('/setting/:id')
	async updateProjectSetting(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProjectSettingDTO
	): Promise<IOrganizationProjectSetting> {
		return await this.commandBus.execute(new OrganizationProjectSettingUpdateCommand(id, entity));
	}

	/**
	 * Finds synced projects with pagination and optional search.
	 * @param params - Pagination and filtering parameters.
	 * @returns A paginated list of organization projects.
	 */
	@ApiOperation({ summary: 'Find synced projects with pagination and optional search.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of synced organization projects',
		type: OrganizationProject,
		isArray: true
	})
	@UseValidationPipe()
	@Get('/synced')
	async findSyncedProjects(
		@Query() params: PaginationParams<OrganizationProject>
	): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.findSyncedProjects(params);
	}

	/**
	 * Get count of organization projects.
	 * @param options - Query options for filtering the count of organization projects.
	 * @returns The total count of organization projects.
	 */
	@ApiOperation({ summary: 'Find organization projects count.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found count',
		type: Number
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiQuery({
		name: 'options',
		description: 'Query options for filtering the count',
		type: CountQueryDTO,
		required: false
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@UseValidationPipe()
	@Get('/count')
	async getCount(@Query() options: CountQueryDTO<OrganizationProject>): Promise<number> {
		return await this.organizationProjectService.countBy(options);
	}

	/**
	 * Find all organization projects in the same tenant using pagination.
	 * @param filter - Pagination parameters and additional filters.
	 * @returns A paginated result containing organization projects.
	 */
	@ApiOperation({
		summary: 'Find all organization project in the same tenant using pagination.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization project in the tenant',
		type: OrganizationProject,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@UseValidationPipe({ transform: true })
	@Get('/pagination')
	async pagination(
		@Query() filter: PaginationParams<OrganizationProject>
	): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.pagination(filter);
	}

	/**
	 * Find all organization projects.
	 * @param params - Pagination parameters and any additional filters.
	 * @returns A paginated result containing organization projects.
	 */
	@ApiOperation({ summary: 'Find all organization projects.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@UseValidationPipe()
	@Get('/')
	async findAll(@Query() params: PaginationParams<OrganizationProject>): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.findAll(params);
	}

	/**
	 * Retrieve an organization project by its ID.
	 * @param id - UUID of the organization project.
	 * @param options - Optional query parameters for relations.
	 * @returns The organization project corresponding to the given ID.
	 */
	@ApiOperation({ summary: 'Find organization project by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Returns the organization project with the specified ID',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Organization project not found'
	})
	@ApiParam({
		name: 'id',
		description: 'UUID of the organization project',
		type: String,
		required: true
	})
	@ApiQuery({
		name: 'options',
		description: 'Relations query options',
		required: false,
		type: RelationsQueryDTO
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: RelationsQueryDTO
	): Promise<IOrganizationProject> {
		return await this.organizationProjectService.findOneByIdString(id, options);
	}

	/**
	 * Create a new organization project.
	 * @param entity - Payload for creating a new organization project.
	 * @returns The newly created organization project.
	 */
	@ApiOperation({ summary: 'Create a new organization project' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization project has been successfully created',
		type: OrganizationProject
	})
	@ApiBody({
		description: 'Payload for creating the organization project',
		type: CreateOrganizationProjectDTO
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD)
	@UseValidationPipe()
	@Post('/')
	async create(@Body() entity: CreateOrganizationProjectDTO): Promise<IOrganizationProject> {
		return await this.commandBus.execute(new OrganizationProjectCreateCommand(entity));
	}

	/**
	 * Check if an employee is a manager of a specific project.
	 * @param projectId - UUID of the organization project.
	 * @param employeeId - UUID of the employee.
	 * @returns True if the employee is a manager of the project, otherwise false.
	 */
	@ApiOperation({
		summary: 'Check if an employee is a manager of a specific project.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Returns true if the employee is a manager of the project, otherwise false.',
		type: Boolean
	})
	@ApiParam({
		name: 'projectId',
		description: 'UUID of the organization project',
		type: String,
		required: true
	})
	@ApiParam({
		name: 'employeeId',
		description: 'UUID of the employee',
		type: String,
		required: true
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/:projectId/is-manager/:employeeId')
	async isProjectManager(
		@Param('projectId', UUIDValidationPipe) projectId: ID,
		@Param('employeeId', UUIDValidationPipe) employeeId: ID
	): Promise<boolean> {
		return await this.organizationProjectService.isManagerOfProject(projectId, employeeId);
	}

	/**
	 * Update an organization project by ID.
	 * @param id - UUID of the organization project
	 * @param entity - Update payload for the organization project
	 * @returns The updated organization project.
	 */
	@ApiOperation({ summary: 'Update organization project by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The organization project has been successfully updated',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Organization project not found'
	})
	@ApiParam({
		name: 'id',
		description: 'UUID of the organization project',
		type: String,
		required: true
	})
	@ApiBody({
		description: 'Payload for updating the organization project',
		type: UpdateOrganizationProjectDTO
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	@UseValidationPipe()
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationProjectDTO
	): Promise<IOrganizationProject> {
		return await this.commandBus.execute(new OrganizationProjectUpdateCommand(id, entity));
	}

	/**
	 * Delete an organization project by ID.
	 * @param id - UUID of the organization project
	 */
	@ApiOperation({ summary: 'Delete organization project by ID' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The organization project has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Organization project not found'
	})
	@ApiParam({
		name: 'id',
		description: 'UUID of the organization project',
		type: String,
		required: true
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_DELETE)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.organizationProjectService.delete(id);
	}
}
