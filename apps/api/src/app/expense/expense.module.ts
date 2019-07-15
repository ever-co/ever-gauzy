import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { Employee, EmployeeService } from '../employee';
import { Organization, OrganizationService } from '../organization';

@Module({
    imports: [
        TypeOrmModule.forFeature([Expense, Employee, Organization]),
        CqrsModule
    ],
    controllers: [ExpenseController],
    providers: [ExpenseService, EmployeeService, OrganizationService, ...CommandHandlers],
    exports: [ExpenseService],
})
export class ExpenseModule { }
