import {
	IEditEntityByMemberInput,
	IPagination,
	PermissionsEnum,
	TaskListTypeEnum
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Request
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationProjectEditByEmployeeCommand } from './commands/organization-project.edit-by-employee.command';
import { OrganizationProject } from './organization-projects.entity';
import { OrganizationProjectsService } from './organization-projects.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationProjects')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationProjectsController extends CrudController<OrganizationProject> {
	constructor(
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly commandBus: CommandBus
	) {
		super(organizationProjectsService);
	}

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
	@Get('employee/:id')
	async findByEmployee(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IPagination<OrganizationProject>> {
		const { findInput = null } = data;
		return this.organizationProjectsService.findByEmployee(id, findInput);
	}

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
	@Get()
	async findAllEmployees(
		@Query('data', ParseJsonPipe) data: any,
		@Request() req
	): Promise<IPagination<OrganizationProject>> {
		const { relations, findInput } = data;
		return this.organizationProjectsService.findAll({
			where: findInput,
			relations
		});
	}

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
	async findProjectsCount(
		@Query('data', ParseJsonPipe) data: any,
		@Request() req
	): Promise<any> {
		const { relations, findInput } = data;
		return this.organizationProjectsService.count({
			where: findInput,
			relations
		});
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('employee')
	async updateEmployee(
		@Body() entity: IEditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationProjectEditByEmployeeCommand(entity)
		);
	}

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
	// @UseGuards(PermissionGuard)
	// @Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('/task-view/:id')
	async updateTaskViewMode(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: { taskViewMode: TaskListTypeEnum }
	): Promise<any> {
		return this.organizationProjectsService.updateTaskViewMode(
			id,
			entity.taskViewMode
			// new OrganizationProjectEditByEmployeeCommand(entity)
		);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async updateProject(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: OrganizationProject
	): Promise<OrganizationProject> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.organizationProjectsService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}
}
