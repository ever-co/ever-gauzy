import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { EmployeeRecurringExpense } from '../employee-recurring-expense/employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from '../employee-recurring-expense/employee-recurring-expense.service';
import { Expense } from '../expense/expense.entity';
import { ExpenseService } from '../expense/expense.service';
import { Income } from '../income/income.entity';
import { IncomeService } from '../income/income.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { QueryHandlers } from './queries/handlers';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

const forFeatureEntities = [
	Income,
	Expense,
	Employee,
	Organization,
	EmployeeRecurringExpense,
	OrganizationRecurringExpense
];

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-statistics', module: EmployeeStatisticsModule }]),
		TypeOrmModule.forFeature(forFeatureEntities),
		MikroOrmModule.forFeature(forFeatureEntities),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeStatisticsController],
	providers: [
		EmployeeStatisticsService,
		IncomeService,
		ExpenseService,
		EmployeeService,
		OrganizationService,
		EmployeeRecurringExpenseService,
		OrganizationRecurringExpenseService,
		...QueryHandlers
	],
	exports: [EmployeeStatisticsService]
})
export class EmployeeStatisticsModule { }
