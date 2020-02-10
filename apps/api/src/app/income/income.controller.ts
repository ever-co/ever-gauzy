import { Controller, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { Income } from './income.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IncomeCreateInput as IIncomeCreateInput } from '@gauzy/models';
import { CommandBus } from '@nestjs/cqrs';
import { IncomeCreateCommand } from './commands/income.create.command';
import { IPagination } from '../core';

@ApiTags('Income')
@Controller()
export class IncomeController extends CrudController<Income> {
	constructor(
		private readonly incomeService: IncomeService,
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
	@Get()
	async findAllIncome(
		@Query('data') data: string
	): Promise<IPagination<Income>> {
		const { relations, findInput, filterDate } = JSON.parse(data);
		return this.incomeService.findAll(
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
		@Body() entity: IIncomeCreateInput,
		...options: any[]
	): Promise<Income> {
		return this.commandBus.execute(new IncomeCreateCommand(entity));
	}
}
