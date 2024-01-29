import { Repository } from 'typeorm';
import { ExpenseCategory } from '../expense-category.entity';

export class TypeOrmExpenseCategoriesRepository extends Repository<ExpenseCategory> { }
