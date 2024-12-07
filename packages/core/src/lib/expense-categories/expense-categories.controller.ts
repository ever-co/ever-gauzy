import { Controller, UseGuards, Get, Query, Put, Param, Body, ValidationPipe, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { IExpenseCategory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from './expense-category.entity';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateExpenseCategoryDTO, UpdateExpenseCategoryDTO } from './dto';
import { ExpenseCategoryCreateCommand, ExpenseCategoryUpdateCommand } from './commands';

@ApiTags('ExpenseCategories')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
@Controller()
export class ExpenseCategoriesController extends CrudController<ExpenseCategory> {
	constructor(
		private readonly _expenseCategoriesService: ExpenseCategoriesService,
		private readonly _commandBus: CommandBus
	) {
		super(_expenseCategoriesService);
	}

	/**
	 * GET all expense categories by pagination
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: PaginationParams<ExpenseCategory>): Promise<IPagination<IExpenseCategory>> {
		return this._expenseCategoriesService.paginate(options);
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
	async findAll(@Query() options: PaginationParams<ExpenseCategory>): Promise<IPagination<IExpenseCategory>> {
		return await this._expenseCategoriesService.findAll(options);
	}

	/**
	 * CREATE expense category
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	async create(
		@Body(
			new ValidationPipe({
				transform: true,
				whitelist: true
			})
		)
		entity: CreateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return await this._commandBus.execute(new ExpenseCategoryCreateCommand(entity));
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
		@Body(
			new ValidationPipe({
				transform: true,
				whitelist: true
			})
		)
		entity: UpdateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return await this._commandBus.execute(new ExpenseCategoryUpdateCommand(id, entity));
	}
}
