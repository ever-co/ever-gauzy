import {
	IExpenseCreateInput,
	PermissionsEnum,
	ISplitExpenseOutput,
	IGetExpenseInput,
	IExpenseReportData,
	ReportGroupFilterEnum,
	IExpense,
	IPagination
} from '@gauzy/contracts';
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
	Delete,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationParams } from '../core';
import { CrudController } from './../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import {
	ExpenseCreateCommand,
	ExpenseDeleteCommand,
	ExpenseUpdateCommand
} from './commands';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { RequestContext } from '../core/context';
import { FindSplitExpenseQuery } from './queries';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { ExpenseMapService } from './expense.map.service';

@ApiTags('Expense')
@UseGuards(TenantPermissionGuard)
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

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IExpense>
	): Promise<IPagination<IExpense>> {
		return this.expenseService.pagination(filter);
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
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IExpense>> {
		const { relations, filterDate } = data;
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
		@Query('data', ParseJsonPipe) data: any,
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<IPagination<ISplitExpenseOutput>> {
		const { relations, filterDate } = data;
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
		const expenses = await this.expenseService.getExpense(request);
		let response: IExpenseReportData[] = [];
		if (request.groupBy === ReportGroupFilterEnum.date) {
			response = this.expenseMapService.mapByDate(expenses);
		} else if (request.groupBy === ReportGroupFilterEnum.employee) {
			response = this.expenseMapService.mapByEmployee(expenses);
		} else if (request.groupBy === ReportGroupFilterEnum.project) {
			response = this.expenseMapService.mapByProject(expenses);
		}
		return response;
	}

	@ApiOperation({ summary: 'Report daily chart' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('report/daily-chart')
	async getDailyReportChartData(@Query() options: IGetExpenseInput) {
		return this.expenseService.getDailyReportChartData(options);
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IExpense>> {
		const { relations, findInput, filterDate } = data;
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: Expense
	): Promise<IExpense> {
		return await this.commandBus.execute(
			new ExpenseUpdateCommand(id, entity)
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: IExpenseCreateInput,
		...options: any[]
	): Promise<IExpense> {
		return await this.commandBus.execute(
			new ExpenseCreateCommand(entity)
		);
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