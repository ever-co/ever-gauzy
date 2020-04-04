import {
	IncomeCreateInput as IIncomeCreateInput,
	PermissionsEnum
} from '@gauzy/models';
import {
	Body,
	Controller,
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
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { RequestContext } from '../core/context';
import { CrudController } from '../core/crud/crud.controller';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { IncomeCreateCommand } from './commands/income.create.command';
import { Income } from './income.entity';
import { IncomeService } from './income.service';

@ApiTags('Income')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class IncomeController extends CrudController<Income> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {
		super(incomeService);
	}

	@ApiOperation({ summary: 'Find all income.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income',
		type: Income
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyIncome(
		@Query('data') data: string
	): Promise<IPagination<Income>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			user: { id: RequestContext.currentUser().id }
		});

		return this.incomeService.findAll(
			{ where: { ...findInput, employeeId: employee.id }, relations },
			filterDate
		);
	}

	@ApiOperation({ summary: 'Find all income.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income',
		type: Income
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get()
	async findAllIncome(
		@Query('data') data: string
	): Promise<IPagination<Income>> {
		const { relations, findInput, filterDate } = JSON.parse(data);
		return this.incomeService.findAll(
			{ where: findInput, relations },
			filterDate
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Income,
		...options: any[]
	): Promise<any> {
		return this.incomeService.create({
			id,
			...entity
		});
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: IIncomeCreateInput,
		...options: any[]
	): Promise<Income> {
		return this.commandBus.execute(new IncomeCreateCommand(entity));
	}
}
