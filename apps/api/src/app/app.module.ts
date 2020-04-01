import { InvoiceModule } from './invoice/invoice.module';
import { InvoiceItemModule } from './invoice-item/invoice-item.module';
import { TagModule } from './tags/tag.module';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { EmployeeModule } from './employee/employee.module';
import { RoleModule } from './role/role.module';
import { OrganizationModule } from './organization/organization.module';
import { IncomeModule } from './income/income.module';
import { ExpenseModule } from './expense/expense.module';
import { EmployeeSettingModule } from './employee-setting';
import { CoreModule } from './core';
import { AuthModule } from './auth/auth.module';
import { SeedDataService } from './core/seeds/SeedDataService';
import { UserOrganizationModule } from './user-organization/user-organization.module';
import { EmployeeStatisticsModule } from './employee-statistics/employee-statistics.module';
import { OrganizationDepartmentModule } from './organization-department/organization-department.module';
import { OrganizationRecurringExpenseModule } from './organization-recurring-expense/organization-recurring-expense.module';
import { EmployeeRecurringExpenseModule } from './employee-recurring-expense/employee-recurring-expense.module';
import { OrganizationClientsModule } from './organization-clients/organization-clients.module';
import { OrganizationPositionsModule } from './organization-positions/organization-positions.module';
import { OrganizationProjectsModule } from './organization-projects/organization-projects.module';
import { OrganizationVendorsModule } from './organization-vendors/organization-vendors.module';
import { OrganizationTeamsModule } from './organization-teams/organization-teams.module';
import { ProposalModule } from './proposal/proposal.module';
import { CountryModule } from './country/country.module';
import { InviteModule } from './invite/invite.module';
import { EmailModule } from './email/email.module';
import { TimeOffPolicyModule } from './time-off-policy/time-off-policy.module';
import { RolePermissionsModule } from './role-permissions/role-permissions.module';
import { TenantModule } from './tenant/tenant.module';
import { EmailTemplateModule } from './email-template/email-template.module';
import { EquipmentModule } from './equipment/equipment.module';
import { EmployeeLevelModule } from './organization_employeeLevel/organization-employee-level.module';
import { ExportAllModule } from './export_import/export-all.module';
import { SentryModule } from '@ntegral/nestjs-sentry';
import { environment } from '@env-api/environment';
import { LogLevel } from '@sentry/types';
import { TaskModule } from './tasks/task.module';
import { EquipmentSharingModule } from './equipment-sharing/equipment-sharing.module';
import { OrganizationEmploymentTypeModule } from './organization-employment-type/organization-employment-type.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { UpworkModule } from './integrations/upwork/upwork.module';
import { HubstaffModule } from './integrations/hubstaff/hubstaff.module';
import { CandidateModule } from './candidate/candidate.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '',
				children: [
					{ path: '/auth', module: AuthModule },
					{ path: '/user', module: UserModule },
					{ path: '/employee', module: EmployeeModule },
					{ path: '/candidate', module: CandidateModule },
					{ path: '/download', module: ExportAllModule },
					{ path: '/role', module: RoleModule },
					{ path: '/organization', module: OrganizationModule },
					{ path: '/income', module: IncomeModule },
					{ path: '/expense', module: ExpenseModule },
					{ path: '/equipment', module: EquipmentModule },
					{ path: '/employee-level', module: EmployeeLevelModule },

					{
						path: '/employee-settings',
						module: EmployeeSettingModule
					},
					{
						path: '/employee-statistics',
						module: EmployeeStatisticsModule
					},
					{
						path: '/user-organization',
						module: UserOrganizationModule
					},
					{
						path: '/organization-department',
						module: OrganizationDepartmentModule
					},
					{
						path: '/organization-clients',
						module: OrganizationClientsModule
					},
					{
						path: '/organization-positions',
						module: OrganizationPositionsModule
					},
					{
						path: '/organization-projects',
						module: OrganizationProjectsModule
					},
					{
						path: '/organization-vendors',
						module: OrganizationVendorsModule
					},
					{
						path: '/organization-recurring-expense',
						module: OrganizationRecurringExpenseModule
					},
					{
						path: '/employee-recurring-expense',
						module: EmployeeRecurringExpenseModule
					},
					{
						path: '/organization-teams',
						module: OrganizationTeamsModule
					},
					{
						path: '/proposal',
						module: ProposalModule
					},
					{
						path: '/country',
						module: CountryModule
					},
					{
						path: '/invite',
						module: InviteModule
					},
					{
						path: '/email',
						module: EmailModule
					},
					{
						path: 'time-off-policy',
						module: TimeOffPolicyModule
					},
					{
						path: 'role-permissions',
						module: RolePermissionsModule
					},
					{
						path: '/tenant',
						module: TenantModule
					},
					{
						path: '/tags',
						module: TagModule
					},
					{
						path: '/tasks',
						module: TaskModule
					},
					{
						path: '/equipment-sharing',
						module: EquipmentSharingModule
					},
					{
						path: '/organization-employment-type',
						module: OrganizationEmploymentTypeModule
					},
					{
						path: '/expense-categories',
						module: ExpenseCategoriesModule
					},
					{
						path: '/timesheet',
						module: TimesheetModule
					},
					{
						path: '/integrations/upwork',
						module: UpworkModule
					},
					{
						path: '/integrations/hubstaff',
						module: HubstaffModule
					},
					{
						path: '/invoices',
						module: InvoiceModule
					},
					{
						path: '/invoice-item',
						module: InvoiceItemModule
					}
				]
			}
		]),
		CoreModule,
		AuthModule,
		UserModule,
		EmployeeModule,
		CandidateModule,
		ExportAllModule,
		EmployeeSettingModule,
		EmployeeStatisticsModule,
		RoleModule,
		OrganizationModule,
		IncomeModule,
		ExpenseModule,
		UserOrganizationModule,
		OrganizationDepartmentModule,
		OrganizationRecurringExpenseModule,
		OrganizationClientsModule,
		OrganizationPositionsModule,
		OrganizationProjectsModule,
		OrganizationVendorsModule,
		EmployeeRecurringExpenseModule,
		OrganizationTeamsModule,
		ProposalModule,
		EmailModule,
		CountryModule,
		InviteModule,
		TimeOffPolicyModule,
		RolePermissionsModule,
		TenantModule,
		EmailTemplateModule,
		TagModule,
		InvoiceModule,
		InvoiceItemModule,
		EmployeeLevelModule,
		...(environment.sentry
			? [
					SentryModule.forRoot({
						dsn: environment.sentry.dns,
						debug: true,
						environment: environment.production
							? 'production'
							: 'development', //production, development
						//release: null, // must create a release in sentry.io dashboard
						logLevel: LogLevel.Error
					})
			  ]
			: []),
		EquipmentModule,
		EquipmentSharingModule,
		TaskModule,
		OrganizationEmploymentTypeModule,
		TimesheetModule,
		UpworkModule,
		HubstaffModule,
		ExpenseCategoriesModule
	],
	controllers: [AppController],
	providers: [AppService, SeedDataService],
	exports: []
})
export class AppModule {}
