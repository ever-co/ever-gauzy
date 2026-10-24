import {
	IStartUpdateTypeInfo,
	IOrganizationRecurringExpenseForEmployeeOutput,
	IRecurringExpenseEditInput,
	IPagination,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseQueryDTO, CrudController } from './../core/crud';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import {
	OrganizationRecurringExpenseCreateCommand,
	OrganizationRecurringExpenseDeleteCommand,
	OrganizationRecurringExpenseEditCommand
} from './commands';
import {
	OrganizationRecurringExpenseByMonthQuery,
	OrganizationRecurringExpenseFindSplitExpenseQuery,
	OrganizationRecurringExpenseStartDateUpdateTypeQuery
} from './queries';
import { Permissions } from '../shared/decorators';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { FindOptionsWhere } from 'typeorm';

/**
 * The recurring costs of an organization.
 *
 * Every write states `ORG_EXPENSES_EDIT` (GHSA-v79w-54p2-wmh5) and every read states `ORG_EXPENSES_VIEW`: the
 * grant the page that shows them requires (the "Expense Recurring" menu entries of the accounting and the
 * organization sections), and the one the expense reads state (`ExpenseController`). The reads used to state
 * no permission at all behind `TenantPermissionGuard` alone, so any member of the tenant (an EMPLOYEE, a
 * VIEWER, a CANDIDATE) could list what the organization pays for and how much. Every default role that holds
 * `ORG_EXPENSES_EDIT` (SUPER_ADMIN, ADMIN, DATA_ENTRY) holds `ORG_EXPENSES_VIEW` too. The employee statistics
 * that fold these costs into profit read them through the service, not through these routes, and are not
 * changed. The GraphQL fields that mirror these reads state the same.
 */
@ApiTags('OrganizationRecurringExpense')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-recurring-expense')
export class OrganizationRecurringExpenseController extends CrudController<OrganizationRecurringExpense> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	/**
	 * Counts the standing costs.
	 *
	 * Overrides the inherited `CrudController.getCount()` route only to state the read grant, `ORG_EXPENSES_VIEW`.
	 *
	 * @param options The criterion, forwarded to the base route.
	 * @returns How many standing costs match.
	 */
	@ApiOperation({ summary: 'Get total record count' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Total record count retrieved successfully' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('count')
	async getCount(@Query() options?: FindOptionsWhere<OrganizationRecurringExpense>): Promise<number | void> {
		return await super.getCount(options);
	}

	/**
	 * Pages through the standing costs.
	 *
	 * Overrides the inherited `CrudController.pagination()` route only to state the read grant, `ORG_EXPENSES_VIEW`.
	 *
	 * @param filter The page and the criterion, forwarded to the base route.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns One page of standing costs.
	 */
	@ApiOperation({ summary: 'Get paginated records' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Records retrieved successfully' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('pagination')
	async pagination(
		@Query() filter?: BaseQueryDTO<OrganizationRecurringExpense>,
		...options: any[]
	): Promise<IPagination<OrganizationRecurringExpense> | undefined> {
		return await super.pagination(filter, ...options);
	}

	/**
	 * GET organization recurring expense by month
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization recurring expense by month.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense',
		type: OrganizationRecurringExpense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('/month')
	async findAllExpenses(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput } = data;
		return this.queryBus.execute(new OrganizationRecurringExpenseByMonthQuery(findInput));
	}

	/**
	 * GET date update type & conflicting expenses
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find start date update type & conflicting expenses for the update'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found start date update type'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('/date-update-type')
	async findStartDateUpdateType(@Query('data', ParseJsonPipe) data: any): Promise<IStartUpdateTypeInfo> {
		const { findInput } = data;
		return this.queryBus.execute(new OrganizationRecurringExpenseStartDateUpdateTypeQuery(findInput));
	}

	/**
	 * GET organization recurring expenses/split expense for employee
	 *
	 * @param data
	 * @param orgId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization recurring expenses for given employee, also known as split recurring expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('/employee/:organizationId')
	async getSplitExpensesForEmployee(
		@Query('data', ParseJsonPipe) data: any,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IPagination<IOrganizationRecurringExpenseForEmployeeOutput>> {
		const { findInput } = data;
		return this.queryBus.execute(new OrganizationRecurringExpenseFindSplitExpenseQuery(organizationId, findInput));
	}

	/**
	 * GET all organization recurring expenses
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization recurring expenses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization recurring expense',
		type: OrganizationRecurringExpense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<OrganizationRecurringExpense>> {
		const { findInput, order = {} } = data;
		return this.organizationRecurringExpenseService.findAll({
			where: findInput,
			order: order
		});
	}

	/**
	 * Reads one standing cost.
	 *
	 * Overrides the inherited `CrudController.findById()` route only to state the read grant, `ORG_EXPENSES_VIEW`.
	 * It is declared after `count`, `pagination`, `month` and `date-update-type` so that `:id` does not shadow
	 * them.
	 *
	 * @param id The standing cost to read.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The standing cost.
	 */
	@ApiOperation({ summary: 'Find record by ID' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Record retrieved successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationRecurringExpense> {
		return await super.findById(id, ...options);
	}

	/**
	 * CREATE organization recurring expense
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new organization recurring expense' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization recurring expense has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Post()
	async create(@Body() entity: OrganizationRecurringExpense): Promise<OrganizationRecurringExpense> {
		return this.commandBus.execute(new OrganizationRecurringExpenseCreateCommand(entity));
	}

	/**
	 * UPDATE organization recurring expense by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IRecurringExpenseEditInput
	): Promise<any> {
		return this.commandBus.execute(new OrganizationRecurringExpenseEditCommand(id, entity));
	}

	/**
	 * DELETE organization recurring expense by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string, @Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { deleteInput } = data;
		return this.commandBus.execute(new OrganizationRecurringExpenseDeleteCommand(id, deleteInput));
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ORG_EXPENSES_EDIT`: the organization-expenses edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationRecurringExpense> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ORG_EXPENSES_EDIT`: the organization-expenses edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationRecurringExpense> {
		return await super.softRecover(id, ...options);
	}
}
