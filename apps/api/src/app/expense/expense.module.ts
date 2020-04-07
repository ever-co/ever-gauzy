import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { UserModule } from '../user/user.module';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { QueryHandlers } from './queries/handlers';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';

@Module({
	imports: [
		UserModule,
		TypeOrmModule.forFeature([
			Expense,
			Employee,
			Organization,
			User,
			ExpenseCategory
		]),
		CqrsModule
	],
	controllers: [ExpenseController],
	providers: [
		ExpenseService,
		EmployeeService,
		OrganizationService,
		UserService,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [ExpenseService]
})
export class ExpenseModule {}
