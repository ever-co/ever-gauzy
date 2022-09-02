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
import { UUIDValidationPipe } from './../shared/pipes';
import { CreateExpenseCategoryDTO, UpdateExpenseCategoryDTO } from './dto';

@ApiTags('ExpenseCategories')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
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
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() options: PaginationParams<IExpenseCategory>
	): Promise<IPagination<IExpenseCategory>> {
		return this.expenseCategoriesService.paginate(options);
	}

	/**
	 * GET all expense categories
	 *
	 *
	 * @param data
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get()
	async findAll(
		@Query() options: PaginationParams<ExpenseCategory>
	): Promise<IPagination<IExpenseCategory>> {
		console.log({ options });
		return await this.expenseCategoriesService.findAll(options);
	}

	/**
	 * CREATE expense category
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	async create(
		@Body(new ValidationPipe({
			transform : true,
			whitelist: true
		})) entity: CreateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return await this.expenseCategoriesService.create(entity);
	}

	/**
	 * UPDATE expense category by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body(new ValidationPipe({
			transform : true,
			whitelist: true
		})) entity: UpdateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return await this.expenseCategoriesService.create({
			id,
			...entity
		});
	}
}
