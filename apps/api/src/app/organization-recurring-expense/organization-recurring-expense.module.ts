import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { OrganizationRecurringExpenseController } from './organization-recurring-expense.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationRecurringExpense]),
    ],
    controllers: [OrganizationRecurringExpenseController],
    providers: [OrganizationRecurringExpenseService],
    exports: [OrganizationRecurringExpenseService],
})
export class OrganizationRecurringExpenseModule { }
