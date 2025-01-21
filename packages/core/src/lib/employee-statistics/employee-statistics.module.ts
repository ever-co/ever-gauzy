import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeRecurringExpenseModule } from '../employee-recurring-expense/employee-recurring-expense.module';
import { ExpenseModule } from '../expense/expense.module';
import { IncomeModule } from '../income/income.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationRecurringExpenseModule } from '../organization-recurring-expense/organization-recurring-expense.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RolePermissionModule,
		EmployeeModule,
		OrganizationModule,
		OrganizationRecurringExpenseModule,
		EmployeeRecurringExpenseModule,
		forwardRef(() => IncomeModule),
		forwardRef(() => ExpenseModule),
		CqrsModule
	],
	controllers: [EmployeeStatisticsController],
	providers: [EmployeeStatisticsService, ...QueryHandlers],
	exports: [EmployeeStatisticsService]
})
export class EmployeeStatisticsModule {}
