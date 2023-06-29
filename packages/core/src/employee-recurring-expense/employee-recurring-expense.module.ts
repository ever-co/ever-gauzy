import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';
import { UserModule } from './../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/employee-recurring-expense',
				module: EmployeeRecurringExpenseModule
			}
		]),
		TypeOrmModule.forFeature([EmployeeRecurringExpense]),
		CqrsModule,
		TenantModule,
		UserModule,
		TaskModule
	],
	controllers: [EmployeeRecurringExpenseController],
	providers: [EmployeeRecurringExpenseService, ...QueryHandlers, ...CommandHandlers],
	exports: [TypeOrmModule, EmployeeRecurringExpenseService]
})
export class EmployeeRecurringExpenseModule {}
