import {
	EditEntityByMemberInput,
	OrganizationDepartmentCreateInput,
	PermissionsEnum
} from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationDepartmentEditByEmployeeCommand } from './commands/organization-department.edit-by-employee.command';
import { OrganizationDepartmentUpdateCommand } from './commands/organization-department.update.command';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';

@ApiTags('Organization-Department')
@Controller()
export class OrganizationDepartmentController extends CrudController<
	OrganizationDepartment
> {
	constructor(
		private readonly organizationDepartmentService: OrganizationDepartmentService,
		private readonly commandBus: CommandBus
	) {
		super(organizationDepartmentService);
	}

	@ApiOperation({
		summary: 'Find all organization departments.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found departments',
		type: OrganizationDepartment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(
		@Param('id') id: string
	): Promise<IPagination<OrganizationDepartment>> {
		return this.organizationDepartmentService.findByEmployee(id);
	}

	@ApiOperation({
		summary: 'Find all organization departments.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found departments',
		type: OrganizationDepartment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllOrganizationDepartments(
		@Query('data') data: string
	): Promise<IPagination<OrganizationDepartment>> {
		const { findInput, relations } = JSON.parse(data);

		return this.organizationDepartmentService.findAll({
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
		@Body() entity: EditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationDepartmentEditByEmployeeCommand(entity)
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
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: OrganizationDepartmentCreateInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationDepartmentUpdateCommand(id, entity)
		);
	}
}
