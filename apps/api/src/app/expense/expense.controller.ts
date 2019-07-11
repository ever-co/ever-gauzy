import { Controller, HttpStatus, Post, Body } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { Expense } from './expense.entity';
import { CrudController } from '../core/crud/crud.controller';
import { CommandBus } from '@nestjs/cqrs';
import { ExpenseCreateInput as IExpenseCreateInput } from '@gauzy/models';
import { ExpenseCreateCommand } from './commands/expense.create.command';

@ApiUseTags('Expense')
@Controller()
export class ExpenseController extends CrudController<Expense> {
    constructor(private readonly expenseService: ExpenseService,
                private readonly commandBus: CommandBus) {
        super(expenseService);
    }

    @ApiOperation({ title: 'Create new record' })
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
