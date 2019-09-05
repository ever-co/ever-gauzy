import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmployeeRecurringExpense]),
    ],
    controllers: [EmployeeRecurringExpenseController],
    providers: [EmployeeRecurringExpenseService],
    exports: [EmployeeRecurringExpenseService],
})
export class EmployeeRecurringExpenseModule { }
