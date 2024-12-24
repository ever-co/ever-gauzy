import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecurringExpense } from '../employee-recurring-expense.entity';

@Injectable()
export class TypeOrmEmployeeRecurringExpenseRepository extends Repository<EmployeeRecurringExpense> {
    constructor(@InjectRepository(EmployeeRecurringExpense) readonly repository: Repository<EmployeeRecurringExpense>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
