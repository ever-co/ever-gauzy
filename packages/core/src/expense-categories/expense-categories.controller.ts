import {
	Controller,
	UseGuards,
	Get,
	Query,
	Put,
	Param,
	Body,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IExpenseCategory, IPagination } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from './expense-category.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('ExpenseCategories')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ExpenseCategoriesController extends CrudController<ExpenseCategory> {
	constructor(
		private readonly expenseCategoriesService: ExpenseCategoriesService
	) {
		super(expenseCategoriesService);
	}

	/**
	 * GET all expense categories by pagination
	 * 
	 * @param filter 
	 * @returns 
	 */
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IExpenseCategory>
	): Promise<IPagination<IExpenseCategory>> {
		return this.expenseCategoriesService.paginate(filter);
	}

	/**
	 * GET all expense categories
	 * 
	 * 
	 * @param data 
	 * @returns 
	 */
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IExpenseCategory>> {
		const { relations, findInput } = data;
		return this.expenseCategoriesService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE expense category by id
	 * 
	 * @param id 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ExpenseCategory,
		...options: any[]
	): Promise<IExpenseCategory> {
		return this.expenseCategoriesService.create({
			id,
			...entity
		});
	}
}
