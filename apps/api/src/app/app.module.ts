import { CandidateSkillModule } from './candidate-skill/candidate-skill.module';
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
import { ImportAllModule } from './export_import/import/import-all.module';
import { SentryModule } from '@ntegral/nestjs-sentry';
import { environment } from '@env-api/environment';
import { LogLevel } from '@sentry/types';
import { TaskModule } from './tasks/task.module';
import { EquipmentSharingModule } from './equipment-sharing/equipment-sharing.module';
import { OrganizationEmploymentTypeModule } from './organization-employment-type/organization-employment-type.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { UpworkModule } from './upwork/upwork.module';
import { HubstaffModule } from './hubstaff/hubstaff.module';
import { CandidateModule } from './candidate/candidate.module';
import { ProductCategoriesModule } from './product-category/product-category-module';
import { ProductTypesModule } from './product-type/product-type-module';
import { ProductModule } from './product/product.module';
import { IntegrationSettingModule } from './integration-setting/integration-setting.module';
import { IntegrationModule } from './integration/integration.module';
import { IntegrationMapModule } from './integration-map/integration-map.module';
import { ProductVariantPriceModule } from './product-variant-price/product-variant-price-module';
import { ProductVariantModule } from './product-variant/product-variant.module';
import { IntegrationEntitySettingModule } from './integration-entity-setting/integration-entity-setting.module';
import { IntegrationEntitySettingTiedEntityModule } from './integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.module';
import { CandidateEducationModule } from './candidate-education/candidate-education.module';
import { CandidateSourceModule } from './candidate_source/candidate_source.module';
import { CandidateDocumentsModule } from './candidate-documents/candidate-documents.module';
import { CandidateExperienceModule } from './candidate-experience/candidate-experience.module';

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
					{
						path: '/candidate-educations',
						module: CandidateEducationModule
					},
					{
						path: '/candidate-documents',
						module: CandidateDocumentsModule
					},
					{
						path: '/candidate-experience',
						module: CandidateExperienceModule
					},
					{
						path: '/candidate-skills',
						module: CandidateSkillModule
					},
					{
						path: '/candidate-source',
						module: CandidateSourceModule
					},
					{ path: '/download', module: ExportAllModule },
					{ path: '/import', module: ImportAllModule },
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
						path: '/integration',
						module: IntegrationModule
					},
					{
						path: '/integration-entity-setting',
						module: IntegrationEntitySettingModule
					},
					{
						path: '/invoices',
						module: InvoiceModule
					},
					{
						path: '/invoice-item',
						module: InvoiceItemModule
					},
					{
						path: '/products',
						module: ProductModule
					},
					{
						path: '/product-categories',
						module: ProductCategoriesModule
					},
					{
						path: '/product-types',
						module: ProductTypesModule
					},
					{
						path: '/product-variant-prices',
						module: ProductVariantPriceModule
					},
					{
						path: '/product-variants',
						module: ProductVariantModule
					}
				]
			}
		]),
		CoreModule,
		AuthModule,
		UserModule,
		EmployeeModule,
		CandidateModule,
		CandidateDocumentsModule,
		CandidateSourceModule,
		CandidateEducationModule,
		CandidateExperienceModule,
		CandidateSkillModule,
		ExportAllModule,
		ImportAllModule,
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
		ExpenseCategoriesModule,
		ProductCategoriesModule,
		ProductTypesModule,
		ProductModule,
		IntegrationSettingModule,
		IntegrationModule,
		IntegrationMapModule,
		ProductVariantPriceModule,
		ProductVariantModule,
		IntegrationEntitySettingModule,
		IntegrationEntitySettingTiedEntityModule
	],
	controllers: [AppController],
	providers: [AppService, SeedDataService],
	exports: []
})
export class AppModule {}
