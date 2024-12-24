import {
	IStartUpdateTypeInfo,
	IOrganizationRecurringExpenseForEmployeeOutput,
	IRecurringExpenseEditInput,
	IPagination
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import {
	OrganizationRecurringExpenseCreateCommand,
	OrganizationRecurringExpenseDeleteCommand,
	OrganizationRecurringExpenseEditCommand
} from './commands';
import {
	OrganizationRecurringExpenseByMonthQuery,
	OrganizationRecurringExpenseFindSplitExpenseQuery,
	OrganizationRecurringExpenseStartDateUpdateTypeQuery
} from './queries';

@ApiTags('OrganizationRecurringExpense')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationRecurringExpenseController extends CrudController<OrganizationRecurringExpense> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	/**
	 * GET organization recurring expense by month
	 * 
	 * @param data 
	 * @returns 
	 */
	 @ApiOperation({
		summary: 'Find all organization recurring expense by month.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense',
		type: OrganizationRecurringExpense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/month')
	async findAllExpenses(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = data;
		return this.queryBus.execute(
			new OrganizationRecurringExpenseByMonthQuery(findInput)
		);
	}

	/**
	 * GET date update type & conflicting expenses
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary:
			'Find start date update type & conflicting expenses for the update'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found start date update type'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/date-update-type')
	async findStartDateUpdateType(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IStartUpdateTypeInfo> {
		const { findInput } = data;
		return this.queryBus.execute(
			new OrganizationRecurringExpenseStartDateUpdateTypeQuery(findInput)
		);
	}

	/**
	 * GET organization recurring expenses/split expense for employee 
	 * 
	 * @param data 
	 * @param orgId 
	 * @returns 
	 */
	@ApiOperation({
		summary:
			'Find all organization recurring expenses for given employee, also known as split recurring expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/employee/:organizationId')
	async getSplitExpensesForEmployee(
		@Query('data', ParseJsonPipe) data: any,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IPagination<IOrganizationRecurringExpenseForEmployeeOutput>> {
		const { findInput } = data;
		return this.queryBus.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery(
				organizationId,
				findInput
			)
		);
	}

	/**
	 * GET all organization recurring expenses
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization recurring expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense',
		type: OrganizationRecurringExpense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput, order = {} } = data;
		return this.organizationRecurringExpenseService.findAll({
			where: findInput,
			order: order
		});
	}

	/**
	 * CREATE organization recurring expense
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new organization recurring expense' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization recurring expense has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: OrganizationRecurringExpense
	): Promise<OrganizationRecurringExpense> {
		return this.commandBus.execute(
			new OrganizationRecurringExpenseCreateCommand(entity)
		);
	}

	/**
	 * UPDATE organization recurring expense by id
	 * 
	 * @param id 
	 * @param entity 
	 * @returns 
	 */
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
		@Body() entity: IRecurringExpenseEditInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationRecurringExpenseEditCommand(id, entity)
		);
	}

	/**
	 * DELETE organization recurring expense by id
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any,
	): Promise<any> {
		const { deleteInput } = data;
		return this.commandBus.execute(
			new OrganizationRecurringExpenseDeleteCommand(id, deleteInput)
		);
	}
}
