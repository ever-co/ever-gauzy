import { Repository } from 'typeorm';
import { ExpenseCategory } from '../expense-category.entity';

export class TypeOrmExpenseCategoryRepository extends Repository<ExpenseCategory> { }
