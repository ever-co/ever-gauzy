import { ExpenseCreateInput as IExpenseCreateInput } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { ExpenseCreateCommand } from './commands/expense.create.command';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';

@ApiTags('Expense')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ExpenseController extends CrudController<Expense> {
	constructor(
		private readonly expenseService: ExpenseService,
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
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<Expense>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		return this.expenseService.findAll(
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
	@Post('/create')
	async create(
		@Body() entity: IExpenseCreateInput,
		...options: any[]
	): Promise<Expense> {
		return this.commandBus.execute(new ExpenseCreateCommand(entity));
	}
}
