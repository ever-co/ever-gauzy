import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Expense } from '../expense.entity';

export class MikroOrmExpenseRepository extends MikroOrmBaseEntityRepository<Expense> { }
