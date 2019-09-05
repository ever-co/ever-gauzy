import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';

@Injectable()
export class EmployeeRecurringExpenseService extends CrudService<EmployeeRecurringExpense> {
    constructor(@InjectRepository(EmployeeRecurringExpense) private readonly employeeRecurringExpense: Repository<EmployeeRecurringExpense>) {
        super(employeeRecurringExpense);
    }
}
