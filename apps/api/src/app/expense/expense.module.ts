import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { UserModule } from '../user/user.module';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { QueryHandlers } from './queries/handlers';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { EmployeeStatisticsService } from '../employee-statistics/employee-statistics.service';
import { EmployeeStatisticsModule } from '../employee-statistics';
import { IncomeService } from '../income/income.service';
import {
	EmployeeRecurringExpenseService,
	EmployeeRecurringExpense
} from '../employee-recurring-expense';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { IncomeModule } from '../income/income.module';
import { Income } from '../income/income.entity';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		UserModule,
		EmployeeStatisticsModule,
		IncomeModule,
		TypeOrmModule.forFeature([
			Expense,
			Employee,
			EmployeeRecurringExpense,
			OrganizationRecurringExpense,
			Income,
			Organization,
			User,
			ExpenseCategory
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [ExpenseController],
	providers: [
		ExpenseService,
		EmployeeService,
		OrganizationService,
		EmployeeStatisticsService,
		UserService,
		IncomeService,
		EmployeeRecurringExpenseService,
		OrganizationRecurringExpenseService,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [ExpenseService]
})
export class ExpenseModule {}
