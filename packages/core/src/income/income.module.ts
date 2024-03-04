import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseModule } from './../employee-recurring-expense/employee-recurring-expense.module';
import { EmployeeStatisticsModule } from './../employee-statistics/employee-statistics.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseModule } from './../expense/expense.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationRecurringExpenseModule } from './../organization-recurring-expense/organization-recurring-expense.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/income', module: IncomeModule }]),
		TypeOrmModule.forFeature([Income]),
		MikroOrmModule.forFeature([Income]),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => ExpenseModule),
		forwardRef(() => EmployeeRecurringExpenseModule),
		forwardRef(() => OrganizationRecurringExpenseModule),
		forwardRef(() => EmployeeStatisticsModule),
		CqrsModule
	],
	controllers: [IncomeController],
	providers: [IncomeService, ...CommandHandlers],
	exports: [IncomeService]
})
export class IncomeModule { }
