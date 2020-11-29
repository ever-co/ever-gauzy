import {
	IExpenseCreateInput,
	PermissionsEnum,
	ISplitExpenseOutput,
	IGetExpenseInput,
	IExpenseReportData
} from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Post,
	Query,
	UseGuards,
	Delete
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { ExpenseCreateCommand } from './commands/expense.create.command';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { RequestContext } from '../core/context';
import { FindSplitExpenseQuery } from './queries/expense.find-split-expense.query';
import { ParseJsonPipe } from '../shared';
import { ExpenseDeleteCommand } from './commands/expense.delete.command';
import { ExpenseUpdateCommand } from './commands/expense.update.command';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ExpenseMapService } from './expense.map.service';

@ApiTags('Expense')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ExpenseController extends CrudController<Expense> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly expenseMapService: ExpenseMapService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {
		super(expenseService);
	}

	// If user is not an employee, then this will return 404
	@ApiOperation({
		summary:
			'Find all expense for the logged in employee, including split expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: Expense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyExpenseWithSplitIncluded(
		@Query('data') data: string
	): Promise<IPagination<Expense>> {
		const { relations, filterDate } = JSON.parse(data);

		const employee = await this.employeeService.findOne({
			user: { id: RequestContext.currentUser().id }
		});

		return await this.queryBus.execute(
			new FindSplitExpenseQuery({
				employeeId: employee.id,
				relations,
				filterDate
			})
		);
	}

	@ApiOperation({
		summary: 'Find all expenses for an employee, including split expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found split expenses'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('include-split/:employeeId')
	async findAllSplitExpenses(
		@Query('data') data: string,
		@Param('employeeId') employeeId: string
	): Promise<IPagination<ISplitExpenseOutput>> {
		const { relations, filterDate } = JSON.parse(data);

		return await this.queryBus.execute(
			new FindSplitExpenseQuery({
				employeeId,
				relations,
				filterDate
			})
		);
	}

	@ApiOperation({
		summary: 'Find all expenses for an employee, including split expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found split expenses'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('report')
	async getExpanseReport(
		@Query() request: IGetExpenseInput
	): Promise<IExpenseReportData[]> {
		const expenses = await this.expenseService.getExpanse(request);

		let response: IExpenseReportData[] = [];
		if (request.groupBy === 'date') {
			response = this.expenseMapService.mapByDate(expenses);
		} else if (request.groupBy === 'employee') {
			response = this.expenseMapService.mapByEmployee(expenses);
		} else if (request.groupBy === 'project') {
			response = this.expenseMapService.mapByProject(expenses);
		}
		return response;
	}

	@ApiOperation({ summary: 'Find all expense.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: Expense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get()
	async findAllExpenses(
		@Query('data') data: string
	): Promise<IPagination<Expense>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		return this.expenseService.findAllExpenses(
			{ where: findInput, relations },
			filterDate
		);
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
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Expense
	): Promise<any> {
		return this.commandBus.execute(new ExpenseUpdateCommand(id, entity));
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: IExpenseCreateInput,
		...options: any[]
	): Promise<Expense> {
		return this.commandBus.execute(new ExpenseCreateCommand(entity));
	}

	@ApiOperation({
		summary: 'Delete record'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Delete('deleteExpense')
	async deleteExpense(@Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { expenseId = null, employeeId = null } = data;
		return this.commandBus.execute(
			new ExpenseDeleteCommand(employeeId, expenseId)
		);
	}
}
