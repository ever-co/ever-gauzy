import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Post,
	Body,
	Param,
	UseGuards
} from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { Employee } from './employee.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { EmployeeCreateInput as IEmployeeCreateInput } from '@gauzy/models';
import { CommandBus } from '@nestjs/cqrs';
import { EmployeeCreateCommand } from './commands';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum } from 'apps/common/enums/roles';

@UseGuards(RoleGuard)
@Roles(RolesEnum.ADMIN)
@ApiUseTags('Employee')
@Controller()
export class EmployeeController extends CrudController<Employee> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {
		super(employeeService);
	}

	@ApiOperation({ title: 'Find all employees.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employees',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<Employee>> {
		const { relations, findInput } = JSON.parse(data);
		return this.employeeService.findAll({ where: findInput, relations });
	}

	@ApiOperation({ title: 'Find User by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id') id: string): Promise<Employee> {
		return this.employeeService.findOne(id);
	}

	@ApiOperation({ title: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/create')
	async create(
		@Body() entity: IEmployeeCreateInput,
		...options: any[]
	): Promise<Employee> {
		return this.commandBus.execute(new EmployeeCreateCommand(entity));
	}
}
