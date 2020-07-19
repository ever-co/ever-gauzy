import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { Expense } from './expense.entity';
import { IPagination } from '../core';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class ExpenseService extends TenantAwareCrudService<Expense> {
	constructor(
		@InjectRepository(Expense)
		private readonly expenseRepository: Repository<Expense>
	) {
		super(expenseRepository);
	}

	public async findAllExpenses(
		filter?: FindManyOptions<Expense>,
		filterDate?: string
	): Promise<IPagination<Expense>> {
		if (filterDate) {
			const dateObject = new Date(filterDate);
			return filter
				? await this.findAll({
						where: {
							valueDate: Between(
								startOfMonth(dateObject),
								endOfMonth(dateObject)
							),
							...(filter.where as Object)
						},
						relations: filter.relations
				  })
				: await this.findAll({
						where: {
							valueDate: Between(
								startOfMonth(dateObject),
								endOfMonth(dateObject)
							)
						}
				  });
		}
		return await this.findAll(filter || {});
	}
}
