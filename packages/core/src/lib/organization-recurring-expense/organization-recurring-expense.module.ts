import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { OrganizationRecurringExpenseController } from './organization-recurring-expense.controller';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import { QueryHandlers } from './queries/handlers';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationRecurringExpenseRepository } from './repository/type-orm-organization-recurring-expense.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationRecurringExpense]),
		MikroOrmModule.forFeature([OrganizationRecurringExpense]),
		RolePermissionModule,
		EmployeeModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [OrganizationRecurringExpenseController],
	providers: [
		OrganizationRecurringExpenseService,
		TypeOrmOrganizationRecurringExpenseRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [OrganizationRecurringExpenseService]
})
export class OrganizationRecurringExpenseModule {}
