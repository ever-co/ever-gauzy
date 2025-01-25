import { Controller, UseGuards, Get, Query, Put, Param, Body, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IExpenseCategory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from './expense-category.entity';
import { CreateExpenseCategoryDTO, UpdateExpenseCategoryDTO } from './dto';
import { ExpenseCategoryCreateCommand, ExpenseCategoryUpdateCommand } from './commands';

@ApiTags('ExpenseCategories')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
@Controller('/expense-categories')
export class ExpenseCategoriesController extends CrudController<ExpenseCategory> {
	constructor(
		private readonly _expenseCategoriesService: ExpenseCategoriesService,
		private readonly _commandBus: CommandBus
	) {
		super(_expenseCategoriesService);
	}

	/**
	 * Retrieves a paginated list of all expense categories.
	 *
	 * @param {PaginationParams<ExpenseCategory>} options - Pagination options.
	 * @returns {Promise<IPagination<IExpenseCategory>>} - Paginated expense category data.
	 *
	 * @example
	 * ```ts
	 * GET /expense-categories/pagination?page=1&limit=10
	 * ```
	 */
	@ApiOperation({ summary: 'Get all expense categories with pagination' })
	@ApiResponse({ status: 200, description: 'Successfully retrieved paginated expense categories' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: PaginationParams<ExpenseCategory>): Promise<IPagination<IExpenseCategory>> {
		return this._expenseCategoriesService.paginate(options);
	}

	/**
	 * Retrieves a list of all expense categories.
	 *
	 * @param {PaginationParams<ExpenseCategory>} options - Query parameters for filtering expense categories.
	 * @returns {Promise<IPagination<IExpenseCategory>>} - List of expense categories.
	 *
	 * @example
	 * ```ts
	 * GET /expense-categories
	 * ```
	 */
	@ApiOperation({ summary: 'Get all expense categories' })
	@ApiResponse({ status: 200, description: 'Successfully retrieved all expense categories' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('/')
	async findAll(@Query() options: PaginationParams<ExpenseCategory>): Promise<IPagination<IExpenseCategory>> {
		return await this._expenseCategoriesService.findAll(options);
	}

	/**
	 * Creates a new expense category.
	 *
	 * @param {CreateExpenseCategoryDTO} entity - The DTO containing expense category details.
	 * @returns {Promise<IExpenseCategory>} - The created expense category.
	 *
	 * @example
	 * ```ts
	 * POST /expense-categories
	 * {
	 *   "name": "Office Supplies",
	 *   "description": "Expenses related to office supplies"
	 * }
	 * ```
	 */
	@ApiOperation({ summary: 'Create a new expense category' })
	@ApiResponse({ status: 201, description: 'Expense category successfully created' })
	@ApiResponse({ status: 400, description: 'Bad request' })
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateExpenseCategoryDTO): Promise<IExpenseCategory> {
		return await this._commandBus.execute(new ExpenseCategoryCreateCommand(entity));
	}

	/**
	 * Updates an existing expense category by its ID.
	 *
	 * @param {ID} id - The unique identifier of the expense category.
	 * @param {UpdateExpenseCategoryDTO} entity - The DTO containing updated expense category details.
	 * @returns {Promise<IExpenseCategory>} - The updated expense category.
	 *
	 * @example
	 * ```ts
	 * PUT /expense-categories/123e4567-e89b-12d3-a456-426614174000
	 * {
	 *   "name": "Updated Category",
	 *   "description": "Updated category description"
	 * }
	 * ```
	 */
	@ApiOperation({ summary: 'Update an expense category by ID' })
	@ApiResponse({ status: 200, description: 'Expense category successfully updated' })
	@ApiResponse({ status: 404, description: 'Expense category not found' })
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateExpenseCategoryDTO
	): Promise<IExpenseCategory> {
		return await this._commandBus.execute(new ExpenseCategoryUpdateCommand(id, entity));
	}
}
