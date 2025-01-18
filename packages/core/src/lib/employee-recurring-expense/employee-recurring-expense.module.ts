import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/employee-recurring-expense',
				module: EmployeeRecurringExpenseModule
			}
		]),
		TypeOrmModule.forFeature([EmployeeRecurringExpense]),
		MikroOrmModule.forFeature([EmployeeRecurringExpense]),
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	controllers: [EmployeeRecurringExpenseController],
	providers: [EmployeeRecurringExpenseService, ...QueryHandlers, ...CommandHandlers],
	exports: [EmployeeRecurringExpenseService]
})
export class EmployeeRecurringExpenseModule {}
