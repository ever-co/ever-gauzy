import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmExpenseCategoryRepository } from './repository/type-orm-expense-category.repository';
import { MikroOrmExpenseCategoryRepository } from './repository/mikro-orm-expense-category.repository';
import { ExpenseCategory } from './expense-category.entity';

@Injectable()
export class ExpenseCategoriesService extends TenantAwareCrudService<ExpenseCategory> {
	constructor(
		@InjectRepository(ExpenseCategory)
		typeOrmExpenseCategoryRepository: TypeOrmExpenseCategoryRepository,

		mikroOrmExpenseCategoryRepository: MikroOrmExpenseCategoryRepository
	) {
		super(typeOrmExpenseCategoryRepository, mikroOrmExpenseCategoryRepository);
	}
}
