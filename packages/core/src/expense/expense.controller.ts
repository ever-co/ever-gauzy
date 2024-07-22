import {
	PermissionsEnum,
	ISplitExpenseOutput,
	IExpenseReportData,
	ReportGroupFilterEnum,
	IExpense,
	IPagination,
	IEmployee
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
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { CrudController, PaginationParams } from '../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ExpenseCreateCommand, ExpenseDeleteCommand, ExpenseUpdateCommand } from './commands';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { RequestContext } from '../core/context';
import { FindSplitExpenseQuery } from './queries';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { ExpenseMapService } from './expense.map.service';
import { CreateExpenseDTO, DeleteExpenseDTO, UpdateExpenseDTO } from './dto';
import { ExpenseReportQueryDTO } from './dto/query';

@ApiTags('Expense')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
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

	/**
	 * GET expense count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Expense>): Promise<number> {
		return await this.expenseService.countBy(options);
	}

	/**
	 * GET expense for same tenant
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Expense>): Promise<IPagination<IExpense>> {
		return this.expenseService.pagination(params);
	}

	// If user is not an employee, then this will return 404
	@ApiOperation({
		summary: 'Find all expense for the logged in employee, including split expenses.'
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('me')
	async findMyExpenseWithSplitIncluded(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IExpense>> {
		const { relations, filterDate } = data;
		const employee = await this.employeeService.findOneByWhereOptions({
			userId: RequestContext.currentUserId()
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('include-split/:employeeId')
	async findAllSplitExpenses(
		@Query('data', ParseJsonPipe) data: any,
		@Param('employeeId', UUIDValidationPipe) employeeId: IEmployee['id']
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('report')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getExpenseReport(@Query() options: ExpenseReportQueryDTO): Promise<IExpenseReportData[]> {
		const expenses = await this.expenseService.getExpense(options);
		let response: IExpenseReportData[] = [];
		if (options.groupBy === ReportGroupFilterEnum.date) {
			response = this.expenseMapService.mapByDate(expenses);
		} else if (options.groupBy === ReportGroupFilterEnum.employee) {
			response = this.expenseMapService.mapByEmployee(expenses);
		} else if (options.groupBy === ReportGroupFilterEnum.project) {
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('report/daily-chart')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getDailyReportChartData(@Query() options: ExpenseReportQueryDTO) {
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
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IExpense>> {
		const { relations, findInput, filterDate } = data;
		return this.expenseService.findAllExpenses({ where: findInput, relations }, filterDate);
	}

	/**
	 * Find expense by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: IExpense['id']): Promise<IExpense> {
		return await this.expenseService.findOneByIdString(id);
	}

	/**
	 * Create Expense
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateExpenseDTO): Promise<IExpense> {
		return await this.commandBus.execute(new ExpenseCreateCommand(entity));
	}

	/**
	 * Update Expense
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateExpenseDTO): Promise<IExpense> {
		return await this.commandBus.execute(new ExpenseUpdateCommand(id, entity));
	}

	/**
	 * Delete Expense
	 *
	 * @param expenseId
	 * @param options
	 * @returns
	 */
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
	@Delete(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) expenseId: string,
		@Query() options: DeleteExpenseDTO
	): Promise<DeleteResult> {
		return await this.commandBus.execute(new ExpenseDeleteCommand(options.employeeId, expenseId));
	}
}
