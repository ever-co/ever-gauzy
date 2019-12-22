import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { IPagination } from '../core';

@ApiTags('OrganizationRecurringExpense')
@Controller()
export class OrganizationRecurringExpenseController extends CrudController<
	OrganizationRecurringExpense
> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
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
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = JSON.parse(data);

		return this.organizationRecurringExpenseService.findAll({
			where: findInput
		});
	}

	@ApiOperation({
		summary: 'Find all organization recurring expenses for given employee.'
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
	@Get('/employee')
	async getForEmployee(
		@Query('data') data: string
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = JSON.parse(data);

		const res = await this.organizationRecurringExpenseService.findAll({
			where: findInput
		});

		// TODO get the count on employees in such org and divide values
		return res;
	}
}
