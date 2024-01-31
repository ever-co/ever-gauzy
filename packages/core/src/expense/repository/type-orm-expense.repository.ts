import { Repository } from 'typeorm';
import { Expense } from '../expense.entity';

export class TypeOrmExpenseRepository extends Repository<Expense> { }