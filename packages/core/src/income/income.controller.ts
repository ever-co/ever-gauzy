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
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IIncome, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { RequestContext } from '../core/context';
import { CrudController, PaginationParams } from './../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { IncomeCreateCommand, IncomeDeleteCommand, IncomeUpdateCommand } from './commands';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { CreateIncomeDTO, DeleteIncomeDTO, UpdateIncomeDTO } from './dto';

@ApiTags('Income')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
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
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('me')
	async findMyIncome(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IIncome>> {
		const { relations, findInput, filterDate } = data;
		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOneByWhereOptions({
			userId: RequestContext.currentUserId()
		});
		return this.incomeService.findAllIncomes(
			{ where: { ...findInput, employeeId: employee.id }, relations },
			filterDate
		);
	}

	/**
	 * GET income count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Income>): Promise<number> {
		return await this.incomeService.countBy(options);
	}

	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Income>): Promise<IPagination<IIncome>> {
		return await this.incomeService.pagination(params);
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
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IIncome>> {
		const { relations, findInput, filterDate } = data;
		return this.incomeService.findAllIncomes({ where: findInput, relations }, filterDate);
	}

	/**
	 * Find income by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IIncome> {
		return await this.incomeService.findOneByIdString(id);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateIncomeDTO): Promise<IIncome> {
		return await this.commandBus.execute(new IncomeCreateCommand(entity));
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateIncomeDTO): Promise<IIncome> {
		return await this.commandBus.execute(new IncomeUpdateCommand(id, entity));
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) incomeId: string,
		@Query() options: DeleteIncomeDTO
	): Promise<DeleteResult> {
		return await this.commandBus.execute(new IncomeDeleteCommand(options.employeeId, incomeId));
	}
}
