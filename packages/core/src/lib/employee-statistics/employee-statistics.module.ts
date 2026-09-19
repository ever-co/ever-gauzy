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
import { EmployeeStatisticsResolver } from './employee-statistics.resolver';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { QueryHandlers } from './queries/handlers';

/**
 * The aggregates computed over an employee's incomes, expenses and bonus policy.
 *
 * **The GraphQL view of the same four answers is declared here, beside the services they call**,
 * because a resolver is an ordinary Nest provider and can only inject what the module hosting it can
 * reach. `EmployeeStatisticsService` is already a provider and already exported, so the resolver's
 * first dependency needed nothing new; the query bus it dispatches three of its four fields through
 * did, and it is re-exported rather than merely imported: a module's imports are not inherited by the
 * module that imports it, so the module that hosts the resolver has to reach the bus itself.
 *
 * The addition is an export and nothing else: no provider, controller or route changed.
 */
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
	providers: [
		EmployeeStatisticsService,
		// The GraphQL view of the same four answers: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmployeeStatisticsResolver,
		...QueryHandlers
	],
	exports: [EmployeeStatisticsService, CqrsModule]
})
export class EmployeeStatisticsModule {}
