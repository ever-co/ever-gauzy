// Copyright (c) 2019-2020 Ever Co. LTD

// Modified code from https://github.com/xmlking/ngx-starter-kit.
// Originally MIT Licensed
// - see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// - original code `Copyright (c) 2018 Sumanth Chinthagunta`

import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { NestModule, Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '../config';
import { environment as env } from '@env-api/environment';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { Role } from '../role/role.entity';
import { Organization } from '../organization/organization.entity';
import { Income } from '../income/income.entity';
import { Expense } from '../expense/expense.entity';
import { EmployeeSetting } from '../employee-setting';
import { RequestContextMiddleware } from './context';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { EmployeeRecurringExpense } from '../employee-recurring-expense/employee-recurring-expense.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationTeams } from '../organization-teams/organization-teams.entity';
import { Proposal } from '../proposal/proposal.entity';
import { Country } from '../country/country.entity';
import { Invite } from '../invite/invite.entity';
import { Email } from '../email/email.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { Tenant } from './../tenant/tenant.entity';
import { EmailTemplate } from '../email-template/email-template.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { Task } from '../tasks/task.entity';
import { Timesheet } from '../timesheet/timesheet.entity';
import { TimeSlot } from '../timesheet/time-slot.entity';
import { Activity } from '../timesheet/activity.entity';
import { Screenshot } from '../timesheet/screenshot.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { EquipmentSharing } from '../equipment-sharing/equipment-sharing.entity';
import { CandidateSource } from '../candidate_source/candidate_source.entity';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';
import { Integration } from '../integration/integration.entity';
import { Candidate } from '../candidate/candidate.entity';

const entities = [
	Invite,
	User,
	Employee,
	Candidate,
	Role,
	Organization,
	Income,
	Expense,
	EmployeeSetting,
	UserOrganization,
	OrganizationDepartment,
	OrganizationClients,
	OrganizationPositions,
	OrganizationProjects,
	OrganizationVendor,
	OrganizationRecurringExpense,
	EmployeeRecurringExpense,
	OrganizationTeams,
	Proposal,
	Country,
	Email,
	TimeOffPolicy,
	RolePermissions,
	Tenant,
	EmailTemplate,
	Tag,
	Invoice,
	InvoiceItem,
	OrganizationEmploymentType,
	Equipment,
	EquipmentSharing,
	EmployeeLevel,
	Task,
	TimeSlot,
	Timesheet,
	TimeLog,
	Activity,
	Screenshot,
	ExpenseCategory,
	CandidateSource,
	IntegrationSetting,
	Integration
];

@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
				...env.database,
				entities
				// subscribers,
				// migrations,
			}),
			inject: [ConfigService]
		})
		/*
    TerminusModule.forRootAsync({
      // Inject the TypeOrmHealthIndicator provided by nestjs/terminus
      inject: [TypeOrmHealthIndicator, DNSHealthIndicator],
      useFactory: (db, dns) => getTerminusOptions(db, dns)
    })
    */
	],
	controllers: [],
	providers: []
})
export class CoreModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes('*');
	}
}
