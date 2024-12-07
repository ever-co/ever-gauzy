import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ExpenseCategory } from '../expense-category.entity';

export class MikroOrmExpenseCategoryRepository extends MikroOrmBaseEntityRepository<ExpenseCategory> { }
