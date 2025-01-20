import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { TypeOrmEmployeeRecurringExpenseRepository } from './repository/type-orm-employee-recurring-expense.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeRecurringExpense]),
		MikroOrmModule.forFeature([EmployeeRecurringExpense]),
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	controllers: [EmployeeRecurringExpenseController],
	providers: [
		EmployeeRecurringExpenseService,
		TypeOrmEmployeeRecurringExpenseRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [EmployeeRecurringExpenseService]
})
export class EmployeeRecurringExpenseModule {}
