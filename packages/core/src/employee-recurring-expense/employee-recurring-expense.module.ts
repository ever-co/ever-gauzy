import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/employee-recurring-expense',
				module: EmployeeRecurringExpenseModule
			}
		]),
		TypeOrmModule.forFeature([EmployeeRecurringExpense, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [EmployeeRecurringExpenseController],
	providers: [
		EmployeeRecurringExpenseService,
		...QueryHandlers,
		UserService,
		...CommandHandlers
	],
	exports: [EmployeeRecurringExpenseService]
})
export class EmployeeRecurringExpenseModule {}
