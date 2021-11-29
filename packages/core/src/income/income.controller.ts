import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	Delete,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IIncome,
	IIncomeCreateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudController, PaginationParams } from './../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import {
	IncomeCreateCommand,
	IncomeDeleteCommand,
	IncomeUpdateCommand
} from './commands';
import { Income } from './income.entity';
import { IncomeService } from './income.service';

@ApiTags('Income')
@UseGuards(TenantPermissionGuard)
@Controller()
export class IncomeController extends CrudController<Income> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {
		super(incomeService);
	}

	@ApiOperation({ summary: 'Find all income.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income',
		type: Income
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyIncome(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IIncome>> {
		const { relations, findInput, filterDate } = data;
		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOneByConditions({
			user: { id: RequestContext.currentUserId() }
		});
		return this.incomeService.findAllIncomes(
			{ where: { ...findInput, employeeId: employee.id }, relations },
			filterDate
		);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IIncome>
	): Promise<IPagination<IIncome>> {
		return this.incomeService.pagination(filter);
	}

	@ApiOperation({ summary: 'Find all income.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income',
		type: Income
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IIncome>> {
		const { relations, findInput, filterDate } = data;
		return this.incomeService.findAllIncomes(
			{ where: findInput, relations },
			filterDate
		);
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
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	@Post()
	async create(
		@Body() entity: IIncomeCreateInput,
		...options: any[]
	): Promise<IIncome> {
		return await this.commandBus.execute(
			new IncomeCreateCommand(entity)
		);
	}

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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: Income,
		...options: any[]
	): Promise<IIncome> {
		return await this.commandBus.execute(
			new IncomeUpdateCommand(id, entity)
		);
	}

	@ApiOperation({
		summary: 'Delete record'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) incomeId: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { employeeId = null } = data;
		return await this.commandBus.execute(
			new IncomeDeleteCommand(employeeId, incomeId)
		);
	}
}
