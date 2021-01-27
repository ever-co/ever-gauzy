import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { ExpenseCategory } from './expense-category.entity';

@Injectable()
export class ExpenseCategoriesService extends CrudService<ExpenseCategory> {
	constructor(
		@InjectRepository(ExpenseCategory)
		private readonly expenseCategoryRepository: Repository<ExpenseCategory>
	) {
		super(expenseCategoryRepository);
	}
}
