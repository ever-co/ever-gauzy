import {
	OrganizationRecurringExpenseForEmployeeOutput,
	RecurringExpenseEditInput,
	RecurringExpenseModel
} from '@gauzy/models';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Post
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationRecurringExpenseDeleteCommand } from './commands/organization-recurring-expense.delete.command';
import { OrganizationRecurringExpenseEditCommand } from './commands/organization-recurring-expense.edit.command';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { OrganizationRecurringExpenseByMonthQuery } from './queries/organization-recurring-expense.by-month.query';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from './queries/organization-recurring-expense.find-split-expense.query';
import { OrganizationRecurringExpenseCreateCommand } from './commands/organization-recurring-expense.create.command';

@ApiTags('OrganizationRecurringExpense')
@Controller()
@UseGuards(AuthGuard('jwt'))
export class OrganizationRecurringExpenseController extends CrudController<
	OrganizationRecurringExpense
> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	@ApiOperation({ summary: 'Create new expense' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The expense has been successfully created.'
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
		@Param('id') id: string,
		@Query('data') data: string
	): Promise<any> {
		const { deleteInput } = JSON.parse(data);

		return this.commandBus.execute(
			new OrganizationRecurringExpenseDeleteCommand(id, deleteInput)
		);
	}

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
	async findAllRecurringExpenses(
		@Query('data') data: string
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = JSON.parse(data);

		return this.organizationRecurringExpenseService.findAll({
			where: findInput
		});
	}

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
	@Get('/employee/:orgId')
	async getSplitExpensesForEmployee(
		@Query('data') data: string,
		@Param('orgId') orgId: string
	): Promise<IPagination<OrganizationRecurringExpenseForEmployeeOutput>> {
		const { findInput } = JSON.parse(data);

		return this.queryBus.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery(
				orgId,
				findInput
			)
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
		@Body() entity: RecurringExpenseEditInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationRecurringExpenseEditCommand(id, entity)
		);
	}

	@ApiOperation({ summary: 'Find all organization recurring expense.' })
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
		@Query('data') data: string
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = JSON.parse(data);

		return this.queryBus.execute(
			new OrganizationRecurringExpenseByMonthQuery(findInput)
		);
	}
}
