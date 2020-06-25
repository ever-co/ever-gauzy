import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { Email } from '../email/email.entity';
import { EmailService } from '../email/email.service';
import { EmailTemplate } from '../email-template/email-template.entity';
import { EmailTemplateService } from '../email-template/email-template.service';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import {
	EmployeeRecurringExpenseService,
	EmployeeRecurringExpense
} from '../employee-recurring-expense';
import { EmployeeSettingService, EmployeeSetting } from '../employee-setting';
import {
	EquipmentSharingService,
	EquipmentSharing
} from '../equipment-sharing';
import { Expense } from '../expense/expense.entity';
import { ExpenseService } from '../expense/expense.service';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { IncomeService } from '../income/income.service';
import { Income } from '../income/income.entity';
import { InviteService } from '../invite/invite.service';
import { Invite } from '../invite/invite.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationDepartmentService } from '../organization-department/organization-department.service';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { InvoiceService } from '../invoice/invoice.service';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { EmployeeLevelService } from '../organization_employeeLevel/organization-employee-level.service';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { OrganizationClientsService } from '../organization-clients/organization-clients.service';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from '../organization-employment-type/organization-employment-type.service';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationPositionsService } from '../organization-positions/organization-positions.service';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamService } from '../organization-team/organization-team.service';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { Proposal } from '../proposal/proposal.entity';
import { ProposalService } from '../proposal/proposal.service';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { Tag } from '../tags/tag.entity';
import { TagService } from '../tags/tag.service';
import { Task } from '../tasks/task.entity';
import { TaskService } from '../tasks/task.service';
import { Tenant } from '../tenant/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { TimeOffPolicyService } from '../time-off-policy/time-off-policy.service';
import { Timesheet } from '../timesheet/timesheet.entity';
import { TimeSlot } from '../timesheet/time-slot.entity';
import { Activity } from '../timesheet/activity.entity';
import { Screenshot } from '../timesheet/screenshot.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { TimeSheetService } from '../timesheet/timesheet/timesheet.service';
import { ActivityService } from '../timesheet/activity.service';
import { ScreenShotService } from '../timesheet/screenshot.service';
import { TimeSlotService } from '../timesheet/time-slot.service';
import { TimeLogService } from '../timesheet/time-log/time-log.service';
import { AppointmentEmployeesService } from '../appointment-employees/appointment-employees.service';
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';
import { ApprovalPolicyService } from '../approval-policy/approval-policy.service';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { CandidateService } from '../candidate/candidate.service';
import { Candidate } from '../candidate/candidate.entity';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EquipmentService } from '../equipment/equipment.service';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { EstimateEmail } from '../estimate-email/estimate-email.entity';

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
			OrganizationTeam,
			OrganizationTeamEmployee,
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
			TimeLog,
			AppointmentEmployees,
			ApprovalPolicy,
			Candidate,
			EstimateEmail
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
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
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
		TimeSlotService,
		AppointmentEmployeesService,
		ApprovalPolicyService,
		CandidateService,
		EstimateEmailService
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
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
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
		TimeSlotService,
		AppointmentEmployeesService,
		ApprovalPolicyService,
		CandidateService,
		EstimateEmailService
	]
})
export class ExportAllModule {}
