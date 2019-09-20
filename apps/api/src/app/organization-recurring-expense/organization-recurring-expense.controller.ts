import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { IPagination } from '../core';

@ApiUseTags('OrganizationRecurringExpense')
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
		title: 'Find all organization recurring expenses recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found recurring expenses recurring expense',
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
}
