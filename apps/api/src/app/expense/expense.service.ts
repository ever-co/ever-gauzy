import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class ExpenseService extends CrudService<Expense> {
    constructor(@InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>) {
        super(expenseRepository);
    }
}
