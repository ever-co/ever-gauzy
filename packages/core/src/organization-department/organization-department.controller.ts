import {
	IEditEntityByMemberInput,
	IOrganizationDepartmentCreateInput,
	IPagination,
	PermissionsEnum
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
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import {
	OrganizationDepartmentEditByEmployeeCommand,
	OrganizationDepartmentUpdateCommand
} from './commands';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationDepartment')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationDepartmentController extends CrudController<OrganizationDepartment> {
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
		@Param('id', UUIDValidationPipe) id: string
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
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<OrganizationDepartment>> {
		const { findInput, relations, order} = data;
		return this.organizationDepartmentService.findAll({
			where: findInput,
			order,
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IOrganizationDepartmentCreateInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationDepartmentUpdateCommand(id, entity)
		);
	}
}
