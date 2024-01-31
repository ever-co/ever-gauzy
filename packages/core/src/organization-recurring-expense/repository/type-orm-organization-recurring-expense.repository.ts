import { Repository } from 'typeorm';
import { OrganizationRecurringExpense } from '../organization-recurring-expense.entity';

export class TypeOrmOrganizationRecurringExpenseRepository extends Repository<OrganizationRecurringExpense> { }