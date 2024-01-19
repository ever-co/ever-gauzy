import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { ExpenseCategory } from './expense-category.entity';

@Injectable()
export class ExpenseCategoriesService extends TenantAwareCrudService<ExpenseCategory> {
	constructor(
		@InjectRepository(ExpenseCategory)
		private readonly expenseCategoryRepository: Repository<ExpenseCategory>,
		@MikroInjectRepository(ExpenseCategory)
		private readonly mikroExpenseCategoryRepository: EntityRepository<ExpenseCategory>
	) {
		super(expenseCategoryRepository, mikroExpenseCategoryRepository);
	}
}
