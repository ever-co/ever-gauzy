import { EditEntityByMemberInput } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationProjectEditByEmployeeCommand } from './commands/organization-project.edit-by-employee.command';
import { OrganizationProjects } from './organization-projects.entity';
import { OrganizationProjectsService } from './organization-projects.service';

@ApiTags('Organization-Projects')
@Controller()
export class OrganizationProjectsController extends CrudController<
	OrganizationProjects
> {
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
		type: OrganizationProjects
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(
		@Param('id') id: string
	): Promise<IPagination<OrganizationProjects>> {
		return this.organizationProjectsService.findByEmployee(id);
	}

	@ApiOperation({
		summary: 'Find all organization projects.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProjects
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationProjects>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationProjectsService.findAll({
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
	@Put('employee')
	async updateEmployee(
		@Body() entity: EditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationProjectEditByEmployeeCommand(entity)
		);
	}
}
