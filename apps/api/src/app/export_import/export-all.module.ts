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
import {
	OrganizationProjects,
	OrganizationProjectsService
} from '../organization-projects';
import {
	OrganizationDepartment,
	OrganizationDepartmentService
} from '../organization-department';
import { Role, RoleService } from '../role';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { InvoiceService } from '../invoice/invoice.service';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { EmployeeLevelService } from '../organization_employeeLevel/organization-employee-level.service';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { OrganizationClientsService } from '../organization-clients/organization-clients.service';
import {
	OrganizationEmploymentTypeService,
	OrganizationEmploymentType
} from '../organization-employment-type';
import {
	OrganizationPositionsService,
	OrganizationPositions
} from '../organization-positions';
import {
	OrganizationRecurringExpenseService,
	OrganizationRecurringExpense
} from '../organization-recurring-expense';
import {
	OrganizationTeamsService,
	OrganizationTeams
} from '../organization-teams';
import {
	OrganizationVendorsService,
	OrganizationVendor
} from '../organization-vendors';
import { ProposalService, Proposal } from '../proposal';
import { RolePermissionsService, RolePermissions } from '../role-permissions';
import { TagService, Tag } from '../tags';
import { TaskService, Task } from '../tasks';
import { TenantService, Tenant } from '../tenant';
import { TimeOffPolicyService, TimeOffPolicy } from '../time-off-policy';
import {
	Timesheet,
	TimeSheetService,
	TimeSlot,
	Activity,
	Screenshot,
	TimeLog,
	ActivityService,
	ScreenShotService,
	TimeLogService,
	TimeSlotService
} from '../timesheet';

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
			OrganizationClients,
			Invoice,
			InvoiceItem,
			EmployeeLevel,
			OrganizationEmploymentType,
			OrganizationPositions,
			OrganizationRecurringExpense,
			OrganizationTeams,
			OrganizationVendor,
			Proposal,
			RolePermissions,
			Tag,
			Task,
			Tenant,
			TimeOffPolicy,
			Timesheet,
			TimeSlot,
			Activity,
			Screenshot,
			TimeLog
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
		OrganizationService,
		InvoiceService,
		InvoiceItemService,
		EmployeeLevelService,
		OrganizationClientsService,
		OrganizationDepartmentService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamsService,
		OrganizationVendorsService,
		ProposalService,
		RoleService,
		RolePermissionsService,
		TagService,
		TaskService,
		TenantService,
		TimeOffPolicyService,
		TimeSheetService,
		ActivityService,
		ScreenShotService,
		TimeLogService,
		TimeSlotService
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
		OrganizationService,
		InvoiceService,
		InvoiceItemService,
		EmployeeLevelService,
		OrganizationClientsService,
		OrganizationDepartmentService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamsService,
		OrganizationVendorsService,
		ProposalService,
		RoleService,
		RolePermissionsService,
		TagService,
		TaskService,
		TenantService,
		TimeOffPolicyService,
		TimeSheetService,
		ActivityService,
		ScreenShotService,
		TimeLogService,
		TimeSlotService
	]
})
export class ExportAllModule {}
