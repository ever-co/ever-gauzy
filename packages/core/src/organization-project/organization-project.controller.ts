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
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganizationProject,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectEditByEmployeeCommand,
	OrganizationProjectUpdateCommand
} from './commands';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectService } from './organization-project.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO, RelationsQueryDTO } from './../shared/dto';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { CreateOrganizationProjectDTO, UpdateOrganizationProjectDTO, UpdateTaskModeDTO } from './dto';

@ApiTags('OrganizationProject')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
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
	@Permissions(
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ORG_PROJECT_VIEW
	)
	@Get('employee/:employeeId')
	@UsePipes(new ValidationPipe())
	async findByEmployee(
		@Param('employeeId', UUIDValidationPipe) employeeId: IEmployee['id'],
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
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ORG_PROJECT_EDIT
	)
	@Put('employee')
	async updateByEmployee(
		@Body() body: IEditEntityByMemberInput
	): Promise<boolean> {
		return await this.commandBus.execute(
			new OrganizationProjectEditByEmployeeCommand(body)
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ORG_PROJECT_EDIT
	)
	@Put('/task-view/:id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async updateTaskViewMode(
		@Param('id', UUIDValidationPipe) id: IOrganizationProject['id'],
		@Body() entity: UpdateTaskModeDTO
	): Promise<IOrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectUpdateCommand({ id, ...entity })
		);
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
	@Get('count')
	@Permissions(
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ORG_PROJECT_VIEW
	)
	@UsePipes(new ValidationPipe())
	async getCount(
		@Query() options: CountQueryDTO<OrganizationProject>
	): Promise<number> {
		return await this.organizationProjectService.countBy(options);
	}

	/**
	 * GET all organization project by Pagination
	 *
	 * @param filter
	 * @returns
	 */
	 @ApiOperation({
		summary:
			'Find all organization project in the same tenant using pagination.'
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
	@Permissions(
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ORG_PROJECT_VIEW
	)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
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
	@Permissions(
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ORG_PROJECT_VIEW
	)
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<OrganizationProject>
	): Promise<IPagination<IOrganizationProject>> {
		return await this.organizationProjectService.findAll(params);
	}

	/**
	 * Find project by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@Permissions(
		PermissionsEnum.ALL_ORG_VIEW,
		PermissionsEnum.ORG_PROJECT_VIEW
	)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: IOrganizationProject['id'],
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
	@Post()
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ORG_PROJECT_ADD
	)
	@UsePipes(new ValidationPipe())
	async create(
		@Body() entity: CreateOrganizationProjectDTO
	): Promise<IOrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectCreateCommand(entity)
		);
	}

	/**
	 * UPDATE organization project by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ORG_PROJECT_EDIT
	)
	@UsePipes(new ValidationPipe())
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganizationProject['id'],
		@Body() entity: UpdateOrganizationProjectDTO
	): Promise<IOrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectUpdateCommand({ id, ...entity })
		);
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
	@Permissions(
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ORG_PROJECT_DELETE
	)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IOrganizationProject['id']
	): Promise<DeleteResult> {
		return await this.organizationProjectService.delete(id);
	}
}
