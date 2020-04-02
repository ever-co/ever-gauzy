import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import {
	UserOrganizationService,
	UserOrganization
} from '../user-organization';
import { EmailService, Email } from '../email';
import { EmailTemplate, EmailTemplateService } from '../email-template';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import {
	EmployeeRecurringExpenseService,
	EmployeeRecurringExpense
} from '../employee-recurring-expense';
import { EmployeeSettingService, EmployeeSetting } from '../employee-setting';
import { Equipment, EquipmentService } from '../equipment';
import {
	EquipmentSharingService,
	EquipmentSharing
} from '../equipment-sharing';
import { ExpenseService, Expense } from '../expense';
import {
	ExpenseCategoriesService,
	ExpenseCategory
} from '../expense-categories';
import { IncomeService } from '../income/income.service';
import { Income } from '../income/income.entity';
import { InviteService } from '../invite/invite.service';
import { Invite } from '../invite/invite.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationProjects } from '../organization-projects';
import { OrganizationDepartment } from '../organization-department';
import { Role } from '../role';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([
			Country,
			User,
			UserOrganization,
			Email,
			EmailTemplate,
			Employee,
			EmployeeRecurringExpense,
			EmployeeSetting,
			Equipment,
			EquipmentSharing,
			Expense,
			ExpenseCategory,
			Income,
			Invite,
			Organization,
			OrganizationDepartment,
			OrganizationProjects,
			Role,
			OrganizationClients
		])
	],
	controllers: [ExportAllController],
	providers: [
		ExportAllService,
		CountryService,
		UserService,
		UserOrganizationService,
		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeRecurringExpenseService,
		EmployeeSettingService,
		EquipmentService,
		EquipmentSharingService,
		ExpenseService,
		ExpenseCategoriesService,
		IncomeService,
		InviteService,
		OrganizationService
	],
	exports: [
		ExportAllService,
		CountryService,
		UserService,
		UserOrganizationService,
		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeRecurringExpenseService,
		EmployeeSettingService,
		EquipmentService,
		EquipmentSharingService,
		ExpenseService,
		ExpenseCategoriesService,
		IncomeService,
		InviteService,
		OrganizationService
	]
})
export class ExportAllModule {}
