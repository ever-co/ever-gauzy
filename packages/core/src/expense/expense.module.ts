import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmployeeStatisticsModule } from './../employee-statistics/employee-statistics.module';
import { EmployeeRecurringExpenseModule } from './../employee-recurring-expense/employee-recurring-expense.module';
import { IncomeModule } from './../income/income.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseMapService } from './expense.map.service';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationRecurringExpenseModule } from './../organization-recurring-expense/organization-recurring-expense.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/expense', module: ExpenseModule }]),
		TypeOrmModule.forFeature([Expense]),
		MikroOrmModule.forFeature([Expense]),
		forwardRef(() => EmployeeStatisticsModule),
		forwardRef(() => EmployeeRecurringExpenseModule),
		forwardRef(() => OrganizationRecurringExpenseModule),
		forwardRef(() => IncomeModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => EmployeeModule),
		CqrsModule
	],
	controllers: [ExpenseController],
	providers: [ExpenseService, ExpenseMapService, ...CommandHandlers, ...QueryHandlers],
	exports: [ExpenseService, ExpenseMapService]
})
export class ExpenseModule { }
