import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from './expense-category.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('expense-categories')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ExpenseCategoriesController extends CrudController<
	ExpenseCategory
> {
	constructor(
		private readonly expenseCategoriesService: ExpenseCategoriesService
	) {
		super(expenseCategoriesService);
	}
}
