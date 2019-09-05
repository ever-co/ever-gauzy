import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';

@ApiUseTags('OrganizationRecurringExpense')
@Controller()
export class OrganizationRecurringExpenseController extends CrudController<OrganizationRecurringExpense> {
    constructor(private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService) {
        super(organizationRecurringExpenseService);
    }
}