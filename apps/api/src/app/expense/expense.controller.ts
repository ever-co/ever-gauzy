import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { Expense } from './expense.entity';
import { CrudController } from '../core/crud/crud.controller';

@ApiUseTags('Expense')
@Controller()
export class ExpenseController extends CrudController<Expense> {
    constructor(private readonly expenseService: ExpenseService) {
        super(expenseService);
    }
}
