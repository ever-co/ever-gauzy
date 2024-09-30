import { CommandBus } from '@nestjs/cqrs';
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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IOrganizationProjectModule, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { CrudController, PaginationParams } from '../core/crud';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { OrganizationProjectModuleService } from './organization-project-module.service';
import {
	CreateOrganizationProjectModuleDTO,
	OrganizationProjectModuleFindInputDTO,
	UpdateOrganizationProjectModuleDTO
} from './dto';
import { OrganizationProjectModuleUpdateCommand } from './commands';

@ApiTags('Project Modules')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationProjectModuleController extends CrudController<OrganizationProjectModule> {
	constructor(
		private readonly projectModuleService: OrganizationProjectModuleService,
		private readonly commandBus: CommandBus
	) {
		super(projectModuleService);
	}

	/**
	 * @description Find employee project modules
	 * @param options - Options finders and relations
	 * @returns - A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleController
	 */
	@ApiOperation({ summary: 'Find employee project modules.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee project modules',
		type: OrganizationProjectModule
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	@Get('employee')
	@UseValidationPipe({ transform: true })
	async getEmployeeProjectModules(
		@Query() params: PaginationParams<OrganizationProjectModule>
	): Promise<IPagination<IOrganizationProjectModule>> {
		return await this.projectModuleService.getEmployeeProjectModules(params);
	}

	/**
	 * @description Find Team's project modules
	 * @param options - Options finders and relations
	 * @returns - A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleController
	 */
	@ApiOperation({ summary: 'Find my team project modules.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found team project modules',
		type: OrganizationProjectModule
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	@Get('team')
	@UseValidationPipe({ transform: true })
	async findTeamProjectModules(
		@Query() params: PaginationParams<OrganizationProjectModule>
	): Promise<IPagination<IOrganizationProjectModule>> {
		return await this.projectModuleService.findTeamProjectModules(params);
	}

	/**
	 * @description Find project modules by employee
	 * @param employeeId - The employee ID for whom to search project modules
	 * @param options - Finders options
	 * @returns A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleController
	 */
	@ApiOperation({
		summary: 'Find Employee project modules.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Employee project modules',
		type: OrganizationProjectModule
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	@Get('employee/:id')
	@UseValidationPipe()
	async findByEmployee(
		@Param('id') employeeId: ID,
		@Query() params: OrganizationProjectModuleFindInputDTO
	): Promise<IPagination<IOrganizationProjectModule>> {
		return await this.projectModuleService.findByEmployee(employeeId, params);
	}

	@ApiOperation({ summary: 'Find all project modules.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found project modules',
		type: OrganizationProjectModule
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	@Get()
	async findAll(
		@Query() params: PaginationParams<OrganizationProjectModule>
	): Promise<IPagination<IOrganizationProjectModule>> {
		return await this.projectModuleService.findAll(params);
	}

	@UseValidationPipe()
	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<OrganizationProjectModule>
	): Promise<OrganizationProjectModule> {
		return this.projectModuleService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'create a project module' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_CREATE)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateOrganizationProjectModuleDTO): Promise<IOrganizationProjectModule> {
		return await this.projectModuleService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing project module' })
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_UPDATE)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationProjectModuleDTO
	): Promise<IOrganizationProjectModule | UpdateResult> {
		return await this.commandBus.execute(new OrganizationProjectModuleUpdateCommand(id, entity));
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.projectModuleService.delete(id);
	}
}
