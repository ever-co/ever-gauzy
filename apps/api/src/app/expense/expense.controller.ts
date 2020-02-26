import {
	ExpenseCreateInput as IExpenseCreateInput,
	PermissionsEnum,
	SplitExpenseOutput
} from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { EmployeeService } from '../employee';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { ExpenseCreateCommand } from './commands/expense.create.command';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { RequestContext } from '../core/context';
import { OrganizationService } from '../organization';

@ApiTags('Expense')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ExpenseController extends CrudController<Expense> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly commandBus: CommandBus
	) {
		super(expenseService);
	}

	@ApiOperation({ summary: 'Find all expense.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: Expense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyExpense(
		@Query('data') data: string
	): Promise<IPagination<Expense>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			user: { id: RequestContext.currentUser().id }
		});

		return this.expenseService.findAll(
			{ where: { ...findInput, employeeId: employee.id }, relations },
			filterDate
		);
	}

	@ApiOperation({ summary: 'Find all expense.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found expense',
		type: Expense
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get()
	async findAllExpenses(
		@Query('data') data: string
	): Promise<IPagination<Expense>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		return this.expenseService.findAll(
			{ where: findInput, relations },
			filterDate
		);
	}

	@ApiOperation({ summary: 'Find all split expense for an organization.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found split expenses'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('split/:orgId')
	async findAllSplitExpenses(
		@Query('data') data: string,
		@Param('orgId') orgId: string
	): Promise<IPagination<SplitExpenseOutput>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		const organization = await this.organizationService.findOne(orgId);

		const { items, total } = await this.expenseService.findAll(
			{
				where: {
					...findInput,
					organization: organization,
					splitExpense: true
				},
				relations
			},
			filterDate
		);

		const orgEmployees = await this.employeeService.findAll({
			where: {
				organization
			}
		});

		const splitItems = items.map((e) => ({
			...e,
			amount: +(
				e.amount / (orgEmployees.total !== 0 ? orgEmployees.total : 1)
			).toFixed(2),
			originalValue: +e.amount,
			employeeCount: orgEmployees.total
		}));

		return { items: splitItems, total };
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Expense,
		...options: any[]
	): Promise<any> {
		return this.expenseService.update(id, entity);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: IExpenseCreateInput,
		...options: any[]
	): Promise<Expense> {
		return this.commandBus.execute(new ExpenseCreateCommand(entity));
	}
}
