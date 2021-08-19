import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseModule } from './../employee-recurring-expense/employee-recurring-expense.module';
import { EmployeeStatisticsModule } from './../employee-statistics/employee-statistics.module';
import { TenantModule } from './../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { OrganizationModule } from './../organization/organization.module';
import { ExpenseModule } from './../expense/expense.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationRecurringExpenseModule } from './../organization-recurring-expense/organization-recurring-expense.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/income', module: IncomeModule }
		]),
		TypeOrmModule.forFeature([ Income ]), 
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => ExpenseModule),
		forwardRef(() => EmployeeRecurringExpenseModule),
		forwardRef(() => OrganizationRecurringExpenseModule),
		forwardRef(() => EmployeeStatisticsModule),
		CqrsModule
	],
	controllers: [IncomeController],
	providers: [
		IncomeService,
		...CommandHandlers
	],
	exports: [IncomeService]
})
export class IncomeModule {}
