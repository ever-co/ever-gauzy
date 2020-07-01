import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { Income } from './income.entity';
import { IPagination } from '../core';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class IncomeService extends TenantAwareCrudService<Income> {
	constructor(
		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>
	) {
		super(incomeRepository);
	}

	public async findAllIncomes(
		filter?: FindManyOptions<Income>,
		filterDate?: string
	): Promise<IPagination<Income>> {
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
