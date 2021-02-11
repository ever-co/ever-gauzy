import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeService } from '../employee/employee.service';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Expense } from '../expense/expense.entity';
import {
	EmployeeRecurringExpense,
	EmployeeRecurringExpenseService
} from '../employee-recurring-expense';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { ExpenseService } from '../expense/expense.service';
import { EmployeeStatisticsService } from '../employee-statistics';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/income', module: IncomeModule }]),
		TypeOrmModule.forFeature([
			Income,
			Employee,
			Organization,
			User,
			Expense,
			EmployeeRecurringExpense,
			OrganizationRecurringExpense
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [IncomeController],
	providers: [
		IncomeService,
		EmployeeService,
		OrganizationService,
		UserService,
		ExpenseService,
		EmployeeStatisticsService,
		EmployeeRecurringExpenseService,
		OrganizationRecurringExpenseService,
		...CommandHandlers
	],
	exports: [IncomeService]
})
export class IncomeModule {}
