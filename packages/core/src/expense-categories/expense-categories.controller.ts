import {
	Controller,
	UseGuards,
	Get,
	Query,
	Put,
	Param,
	Body,
	UsePipes,
	ValidationPipe,
	Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IExpenseCategory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from './expense-category.entity';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateExpenseCategoryDTO, UpdateExpenseCategoryDTO } from './dto';

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
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

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Post()
	@UsePipes(new ValidationPipe({ transform : true, whitelist: true }))
	async create(
		@Body() entity: CreateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return this.expenseCategoriesService.create({
			...entity
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Put(':id')
	@UsePipes(new ValidationPipe({ transform : true, whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return this.expenseCategoriesService.create({
			id,
			...entity
		});
	}
}
