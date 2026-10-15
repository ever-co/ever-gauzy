import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BulkExecutor } from '../api/bulk-executor.service';
import { FieldVisibility } from '../api/field-visibility.service';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { ExpenseResolver } from './expense.resolver';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmployeeStatisticsModule } from './../employee-statistics/employee-statistics.module';
import { EmployeeRecurringExpenseModule } from './../employee-recurring-expense/employee-recurring-expense.module';
import { IncomeModule } from './../income/income.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseMapService } from './expense.map.service';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationRecurringExpenseModule } from './../organization-recurring-expense/organization-recurring-expense.module';
import { TypeOrmExpenseRepository } from './repository/type-orm-expense.repository';
import { MikroOrmExpenseRepository } from './repository/mikro-orm-expense.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Expense]),
		MikroOrmModule.forFeature([Expense]),
		RolePermissionModule,
		EmployeeModule,
		forwardRef(() => EmployeeStatisticsModule),
		forwardRef(() => EmployeeRecurringExpenseModule),
		forwardRef(() => OrganizationRecurringExpenseModule),
		forwardRef(() => IncomeModule),
		CqrsModule
	],
	controllers: [ExpenseController],
	providers: [
		ExpenseService,
		ExpenseMapService,
		// The GraphQL surface is declared beside the service it calls, so the host that scans this
		// module for resolvers reaches everything the resolver injects.
		ExpenseResolver,
		// Both surfaces apply a batch of expenses with the platform's executor, which authorises it through
		// the platform's field visibility.
		BulkExecutor,
		FieldVisibility,
		TypeOrmExpenseRepository,
		MikroOrmExpenseRepository,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [ExpenseService, ExpenseMapService, BulkExecutor]
})
export class ExpenseModule {}