import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeRecurringExpense]), CqrsModule],
	controllers: [EmployeeRecurringExpenseController],
	providers: [
		EmployeeRecurringExpenseService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [EmployeeRecurringExpenseService]
})
export class EmployeeRecurringExpenseModule {}
