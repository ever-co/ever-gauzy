import { Controller, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { Expense } from './expense.entity';
import { CrudController } from '../core/crud/crud.controller';
import { CommandBus } from '@nestjs/cqrs';
import { ExpenseCreateInput as IExpenseCreateInput } from '@gauzy/models';
import { ExpenseCreateCommand } from './commands/expense.create.command';
import { IPagination } from '../core';

@ApiTags('Expense')
@Controller()
export class ExpenseController extends CrudController<Expense> {
    constructor(private readonly expenseService: ExpenseService,
        private readonly commandBus: CommandBus) {
        super(expenseService);
    }

    @ApiOperation({ summary: 'Find all expense.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found expense', type: Expense })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(@Query('data') data: string): Promise<IPagination<Expense>> {
        const { relations, findInput, filterDate } = JSON.parse(data);

        return this.expenseService.findAll({ where: findInput, relations }, filterDate);
    }

    @ApiOperation({ summary: 'Create new record' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' /*, type: T*/ })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input, The response body may contain clues as to what went wrong',
    })
    @Post('/create')
    async create(@Body() entity: IExpenseCreateInput, ...options: any[]): Promise<Expense> {
        return this.commandBus.execute(
            new ExpenseCreateCommand(entity)
        );
    }
}
