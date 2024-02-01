import { EntityRepository } from '@mikro-orm/core';
import { OrganizationRecurringExpense } from '../organization-recurring-expense.entity';

export class MikroOrmOrganizationRecurringExpenseRepository extends EntityRepository<OrganizationRecurringExpense> { }