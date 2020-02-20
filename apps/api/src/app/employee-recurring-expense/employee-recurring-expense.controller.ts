import { RecurringExpenseEditInput } from '@gauzy/models';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { EmployeeRecurringExpenseDeleteCommand } from './commands/employee-recurring-expense.delete.command';
import { EmployeeRecurringExpenseEditCommand } from './commands/employee-recurring-expense.edit.command';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { EmployeeRecurringExpenseByMonthQuery } from './queries/employee-recurring-expense.by-month.query';

@ApiTags('EmployeeRecurringExpense')
@Controller()
export class EmployeeRecurringExpenseController extends CrudController<
	EmployeeRecurringExpense
> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {
		super(employeeRecurringExpenseService);
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
			new EmployeeRecurringExpenseDeleteCommand(id, deleteInput)
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
			new EmployeeRecurringExpenseEditCommand(id, entity)
		);
	}

	@ApiOperation({ summary: 'Find all employee recurring expense.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee recurring expense',
		type: EmployeeRecurringExpense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/month')
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<EmployeeRecurringExpense>> {
		const { findInput } = JSON.parse(data);

		return this.queryBus.execute(
			new EmployeeRecurringExpenseByMonthQuery(findInput)
		);
	}
}
