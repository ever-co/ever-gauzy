import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommandHandlers } from './commands/handlers';
import { OrganizationRecurringExpenseController } from './organization-recurring-expense.controller';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationRecurringExpense]),
		CqrsModule
	],
	controllers: [OrganizationRecurringExpenseController],
	providers: [
		OrganizationRecurringExpenseService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [OrganizationRecurringExpenseService]
})
export class OrganizationRecurringExpenseModule {}
