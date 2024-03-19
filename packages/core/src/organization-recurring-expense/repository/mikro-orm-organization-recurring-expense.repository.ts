import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationRecurringExpense } from '../organization-recurring-expense.entity';

export class MikroOrmOrganizationRecurringExpenseRepository extends EntityRepository<OrganizationRecurringExpense> { }
