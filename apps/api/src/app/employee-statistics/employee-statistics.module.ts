import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee, EmployeeService } from '../employee';
import {
	EmployeeRecurringExpense,
	EmployeeRecurringExpenseService
} from '../employee-recurring-expense';
import { Expense, ExpenseService } from '../expense';
import { Income, IncomeService } from '../income';
import { Organization, OrganizationService } from '../organization';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Income,
			Expense,
			Employee,
			Organization,
			EmployeeRecurringExpense
		]),
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
		...QueryHandlers
	],
	exports: [EmployeeStatisticsService]
})
export class EmployeeStatisticsModule {}
