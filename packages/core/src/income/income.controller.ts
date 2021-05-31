import { IIncomeCreateInput, PermissionsEnum } from '@gauzy/contracts';
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
	Delete
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { RequestContext } from '../core/context';
import { CrudController } from '../core/crud/crud.controller';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { IncomeCreateCommand } from './commands/income.create.command';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { ParseJsonPipe } from '../shared';
import { IncomeDeleteCommand } from './commands/income.delete.command';
import { IncomeUpdateCommand } from './commands/income.update.command';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('Income')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	): Promise<IPagination<Income>> {
		const { relations, findInput, filterDate } = data;

		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			user: { id: RequestContext.currentUser().id }
		});

		return this.incomeService.findAllIncomes(
			{ where: { ...findInput, employeeId: employee.id }, relations },
			filterDate
		);
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
	async findAllIncome(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Income>> {
		const { relations, findInput, filterDate } = data;
		return this.incomeService.findAllIncomes(
			{ where: findInput, relations },
			filterDate
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
		@Param('id') id: string,
		@Body() entity: Income,
		...options: any[]
	): Promise<any> {
		return this.commandBus.execute(new IncomeUpdateCommand(id, entity));
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
	@Post('/create')
	async create(
		@Body() entity: IIncomeCreateInput,
		...options: any[]
	): Promise<Income> {
		return this.commandBus.execute(new IncomeCreateCommand(entity));
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
	@Delete('deleteIncome')
	async deleteIncome(@Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { incomeId = null, employeeId = null } = data;
		return this.commandBus.execute(
			new IncomeDeleteCommand(employeeId, incomeId)
		);
	}
}
