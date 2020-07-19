import {
	Controller,
	UseGuards,
	Get,
	Query,
	Put,
	Param,
	Body
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
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

	@Get()
	async findAllOrganizationExpenseCategories(
		@Query('data') data: string
	): Promise<IPagination<ExpenseCategory>> {
		const { relations, findInput } = JSON.parse(data);
		return this.expenseCategoriesService.findAll({
			where: findInput,
			relations
		});
	}
	@Put(':id')
	async updateOrganizationExpenseCategories(
		@Param('id') id: string,
		@Body() entity: ExpenseCategory,
		...options: any[]
	): Promise<ExpenseCategory> {
		return this.expenseCategoriesService.create({
			id,
			...entity
		});
	}
}
