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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
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
import { ManagerOrPermissions } from './decorators/manager-or-permission.decorator';
import { ManagerOrPermissionGuard } from './guards/manager-or-permission.guard';

@ApiTags('OrganizationProject')
@UseGuards(TenantPermissionGuard, ManagerOrPermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/organization-projects')
export class OrganizationProjectController extends CrudController<OrganizationProject> {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly commandBus: CommandBus
	) {
		super(organizationProjectService);
	}

	/**
	 * GET organization project by employee
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization projects by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/employee/:employeeId')
	@UseValidationPipe()
	async findByEmployee(
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query() options: TenantOrganizationBaseDTO
	): Promise<IOrganizationProject[]> {
		return await this.organizationProjectService.findByEmployee(employeeId, options);
	}

	/**
	 * UPDATE organization project by employee
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	@Put('/employee')
	async updateByEmployee(@Body() body: IOrganizationProjectEditByEmployeeInput): Promise<boolean> {
		return await this.commandBus.execute(new OrganizationProjectEditByEmployeeCommand(body));
	}

	/**
	 * UPDATE organization project task view mode
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	@Put('/task-view/:id')
	@UseValidationPipe({ whitelist: true })
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
	 * @returns A promise that resolves to an `IOrganizationProject` object representing the updated project settings.
	 */
	@Put('/setting/:id')
	@UseValidationPipe({ whitelist: true })
	async updateProjectSetting(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProjectSettingDTO
	): Promise<IOrganizationProjectSetting> {
		return await this.commandBus.execute(new OrganizationProjectSettingUpdateCommand(id, entity));
	}

	/**
	 *
	 * @param params
	 * @returns
	 */
	@Get('/synced')
	@UseValidationPipe()
	async findSyncedProjects(
		@Query() params: PaginationParams<OrganizationProject>
	): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.findSyncedProjects(params);
	}

	/**
	 * GET organization project count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find organization projects count.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found count',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/count')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@UseValidationPipe()
	async getCount(@Query() options: CountQueryDTO<OrganizationProject>): Promise<number> {
		return await this.organizationProjectService.countBy(options);
	}

	/**
	 * GET all organization project by Pagination
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization project in the same tenant using pagination.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization project in the tenant',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<OrganizationProject>
	): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.pagination(filter);
	}

	/**
	 * GET all organization project
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization projects.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<OrganizationProject>): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.findAll(params);
	}

	/**
	 * Find project by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: RelationsQueryDTO
	): Promise<IOrganizationProject> {
		return await this.organizationProjectService.findOneByIdString(id, options);
	}

	/**
	 * CREATE organization project
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD)
	@UseValidationPipe()
	@Post('/')
	async create(@Body() entity: CreateOrganizationProjectDTO): Promise<IOrganizationProject> {
		return await this.commandBus.execute(new OrganizationProjectCreateCommand(entity));
	}

	/**
	 * CHECK if an employee is a manager of a project
	 */
	@ApiOperation({
		summary: 'Check if an employee is a manager of a specific project.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Returns true if the employee is a manager of the project, otherwise false.',
		type: Boolean
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	@Get('/:projectId/is-manager/:employeeId')
	async isManager(
		@Param('projectId', UUIDValidationPipe) projectId: ID,
		@Param('employeeId', UUIDValidationPipe) employeeId: ID
	): Promise<boolean> {
		return await this.organizationProjectService.isManagerOfProject(projectId, employeeId);
	}

	/**
	 * UPDATE organization project by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
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
	 * Delete organization project
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete organization team' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_DELETE)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.organizationProjectService.delete(id);
	}
}
