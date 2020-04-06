import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeRecurringExpense, User]),
		CqrsModule
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
