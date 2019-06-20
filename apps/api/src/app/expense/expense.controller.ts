import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';

@ApiUseTags('Expense')
@Controller()
export class ExpenseController {
    constructor(private readonly expenseService: ExpenseService) {
    }
}
