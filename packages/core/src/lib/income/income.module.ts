import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
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
import { TypeOrmIncomeRepository } from './repository/type-orm-income.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Income]),
		MikroOrmModule.forFeature([Income]),
		CqrsModule,
		forwardRef(() => RolePermissionModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => ExpenseModule),
		forwardRef(() => EmployeeRecurringExpenseModule),
		forwardRef(() => OrganizationRecurringExpenseModule),
		forwardRef(() => EmployeeStatisticsModule)
	],
	controllers: [IncomeController],
	providers: [IncomeService, TypeOrmIncomeRepository, ...CommandHandlers],
	exports: [IncomeService]
})
export class IncomeModule {}
