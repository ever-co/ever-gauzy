import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';

@Injectable()
export class ExpenseService {
    constructor(@InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>) {
    }
}
