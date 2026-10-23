import {
	PermissionsEnum,
	ISplitExpenseOutput,
	IExpenseReportData,
	ReportGroupFilterEnum,
	IExpense,
	IExpenseCreateInput,
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
	Delete
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import {
	BulkExecutor,
	BulkOperation,
	BulkResult,
	IBulkCreateRequest,
	applyAsSingleCreate,
	bulkCreateRequest,
	bulkOptionsOf,
	singleRouteBody
} from '../api';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ExpenseCreateCommand, ExpenseDeleteCommand, ExpenseUpdateCommand } from './commands';
import { Expense } from './expense.entity';
import { ExpenseService, IExpenseStatistics } from './expense.service';
import { RequestContext } from '../core/context';
import { FindSplitExpenseQuery } from './queries';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { ExpenseMapService } from './expense.map.service';
import { CreateExpenseDTO, DeleteExpenseDTO, UpdateExpenseDTO } from './dto';
import { ExpenseReportQueryDTO } from './dto/query';

@ApiTags('Expense')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
@Controller('/expense')
export class ExpenseController extends CrudController<Expense> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly expenseMapService: ExpenseMapService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly bulkExecutor: BulkExecutor
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
	async pagination(@Query() params: BaseQueryDTO<Expense>): Promise<IPagination<IExpense>> {
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

	/**
	 * The report's figures as exact totals.
	 *
	 * Reads the same rows `GET /expense/report` reads, under the same selectors and the same view grant, and
	 * answers them summed per currency and per day, employee and project — as decimal strings, so no figure
	 * is a rounded float. `groupBy` is accepted (it is a member of the shared query) and ignored: every
	 * grouping is answered at once.
	 *
	 * @param options The report's own selectors: organization, window, employees, projects, category.
	 * @returns The count, the totals per currency, and the totals per day, employee and project.
	 */
	@ApiOperation({ summary: 'Expense statistics: exact totals per currency, day, employee and project.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The totals of the selected expenses.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid selectors.' })
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('statistics')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getStatistics(@Query() options: ExpenseReportQueryDTO): Promise<IExpenseStatistics> {
		return this.expenseService.getStatistics(options);
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
	 * POST expenses in bulk
	 *
	 * One request records many expenses and answers one outcome per item. The batch is the platform's —
	 * `@BulkOperation` declares what this route accepts, the executor is configured from that declaration,
	 * authorises the whole request once and refuses a batch it cannot read before writing anything.
	 *
	 * **Each item is `POST /expense`**: its body runs through that route's own validation pipe and then
	 * through that route's handler, which dispatches `ExpenseCreateCommand` — so each expense is recorded,
	 * and its employee's average expense recomputed, exactly as a single expense is. The route runs under
	 * the controller's permission, as the create route does, and the declaration states that same grant.
	 *
	 * A batch records what it can and reports the rest; **`atomic: true` is refused before item 0**
	 * (`BULK_ATOMIC_UNSUPPORTED`, declared `atomic: false`): each item runs the single create, which writes
	 * through its own repositories, so the batch cannot be rolled back as one. The route declares no dry run
	 * and no write mode either (see `bulkCreateRequest`).
	 *
	 * @param request The batch: the items, each the body `POST /expense` takes.
	 * @returns What applied, what did not, and the counts derived from both.
	 */
	@ApiOperation({ summary: 'Create expenses in bulk' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The batch was applied, with one outcome per item' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request or an item could not be read, or it asked for "atomic" (BULK_ATOMIC_UNSUPPORTED)'
	})
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'BULK_LIMIT_EXCEEDED' })
	@ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'BULK_ALL_ITEMS_FAILED' })
	@Idempotent({ scope: 'expense.bulk', required: false, resourceType: 'expense' })
	@BulkOperation({
		resource: 'expense',
		// The platform's cap for every resource but the price and stock matrices: an item is one expense row
		// and one recomputation of its employee's average expense.
		maxItems: 200,
		permission: PermissionsEnum.ORG_EXPENSES_EDIT,
		// Each item is the single create, which writes through its own repositories: no batch transaction.
		atomic: false
	})
	@Post('/bulk')
	async bulk(@Body() request: IBulkCreateRequest<IExpenseCreateInput>): Promise<BulkResult<IExpenseCreateInput>> {
		const batch = bulkCreateRequest(request);

		return await this.bulkExecutor.execute<IExpenseCreateInput>(
			batch,
			(item, context) => applyAsSingleCreate(item, context, (body) => this.createAsSingleRoute(body)),
			bulkOptionsOf(ExpenseController, 'bulk')
		);
	}

	/**
	 * Records one item of a batch exactly as `POST /expense` records its body: through the route's own pipes,
	 * then through the route's handler.
	 *
	 * @param body The item, as the single route's body.
	 * @returns The expense recorded.
	 */
	private async createAsSingleRoute(body: IExpenseCreateInput): Promise<IExpense> {
		return await this.create(await singleRouteBody<CreateExpenseDTO>(ExpenseController, 'create')(body));
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
