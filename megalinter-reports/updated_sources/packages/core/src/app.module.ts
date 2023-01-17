import { HttpException, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import {
	ThrottlerGuard,
	ThrottlerModule,
	ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { SentryInterceptor, SentryModule } from '@ntegral/nestjs-sentry';
import {
	ServeStaticModule,
	ServeStaticModuleOptions,
} from '@nestjs/serve-static';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { Integrations as SentryIntegrations } from '@sentry/node';
import { Integrations as TrackingIntegrations } from '@sentry/tracing';
import {
	initialize as initializeUnleash,
	InMemStorageProvider,
	UnleashConfig,
} from 'unleash-client';
import { LanguagesEnum } from '@gauzy/contracts';
import { ConfigService, environment } from '@gauzy/config';
import * as path from 'path';
import * as moment from 'moment';
import { CandidateInterviewersModule } from './candidate-interviewers/candidate-interviewers.module';
import { CandidateSkillModule } from './candidate-skill/candidate-skill.module';
import { InvoiceModule } from './invoice/invoice.module';
import { InvoiceItemModule } from './invoice-item/invoice-item.module';
import { TagModule } from './tags/tag.module';
import { StatusModule } from './statuses/status.module';
import { SkillModule } from './skills/skill.module';
import { LanguageModule } from './language/language.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { HomeModule } from './home/home.module';
import { EmployeeModule } from './employee/employee.module';
import { RoleModule } from './role/role.module';
import { OrganizationModule } from './organization/organization.module';
import { IncomeModule } from './income/income.module';
import { ExpenseModule } from './expense/expense.module';
import { EmployeeSettingModule } from './employee-setting/employee-setting.module';
import { EmployeeJobPostModule } from './employee-job/employee-job.module';
import { EmployeeAppointmentModule } from './employee-appointment/employee-appointment.module';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { UserOrganizationModule } from './user-organization/user-organization.module';
import { EmployeeStatisticsModule } from './employee-statistics/employee-statistics.module';
import { OrganizationDepartmentModule } from './organization-department/organization-department.module';
import { OrganizationRecurringExpenseModule } from './organization-recurring-expense/organization-recurring-expense.module';
import { EmployeeRecurringExpenseModule } from './employee-recurring-expense/employee-recurring-expense.module';
import { OrganizationContactModule } from './organization-contact/organization-contact.module';
import { OrganizationPositionModule } from './organization-position/organization-position.module';
import { OrganizationProjectModule } from './organization-project/organization-project.module';
import { OrganizationVendorModule } from './organization-vendor/organization-vendor.module';
import { OrganizationTeamModule } from './organization-team/organization-team.module';
import { OrganizationTeamEmployeeModule } from './organization-team-employee/organization-team-employee.module';
import { OrganizationAwardModule } from './organization-award/organization-award.module';
import { OrganizationLanguageModule } from './organization-language/organization-language.module';
import { OrganizationDocumentModule } from './organization-document/organization-document.module';
import { ProposalModule } from './proposal/proposal.module';
import { CountryModule } from './country/country.module';
import { CurrencyModule } from './currency/currency.module';
import { InviteModule } from './invite/invite.module';
import { EmailModule } from './email/email.module';
import { TimeOffPolicyModule } from './time-off-policy/time-off-policy.module';
import { RolePermissionModule } from './role-permission/role-permission.module';
import { TenantModule } from './tenant/tenant.module';
import { EmailTemplateModule } from './email-template/email-template.module';
import { EquipmentModule } from './equipment/equipment.module';
import { EmployeeLevelModule } from './employee-level/employee-level.module';
import { ExportAllModule } from './export-import/export/export-all.module';
import { ImportAllModule } from './export-import/import/import-all.module';
import { TaskModule } from './tasks/task.module';
import { EquipmentSharingModule } from './equipment-sharing/equipment-sharing.module';
import { OrganizationEmploymentTypeModule } from './organization-employment-type/organization-employment-type.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { UpworkModule } from './upwork/upwork.module';
import { HubstaffModule } from './hubstaff/hubstaff.module';
import { CandidateModule } from './candidate/candidate.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductTypeModule } from './product-type/product-type.module';
import { ProductModule } from './product/product.module';
import { IntegrationSettingModule } from './integration-setting/integration-setting.module';
import { IntegrationMapModule } from './integration-map/integration-map.module';
import { ProductVariantPriceModule } from './product-variant-price/product-variant-price-module';
import { ProductVariantModule } from './product-variant/product-variant.module';
import { IntegrationEntitySettingModule } from './integration-entity-setting/integration-entity-setting.module';
import { IntegrationEntitySettingTiedModule } from './integration-entity-setting-tied/integration-entity-setting-tied.module';
import { CandidateEducationModule } from './candidate-education/candidate-education.module';
import { CandidateSourceModule } from './candidate-source/candidate-source.module';
import { CandidateDocumentsModule } from './candidate-documents/candidate-documents.module';
import { CandidateExperienceModule } from './candidate-experience/candidate-experience.module';
import { CandidateFeedbacksModule } from './candidate-feedbacks/candidate-feedbacks.module';
import { ProductVariantSettingModule } from './product-setting/product-setting.module';
import { IntegrationModule } from './integration/integration.module';
import { IntegrationTenantModule } from './integration-tenant/integration-tenant.module';
import { CandidateInterviewModule } from './candidate-interview/candidate-interview.module';
import { AppointmentEmployeesModule } from './appointment-employees/appointment-employees.module';
import { ApprovalPolicyModule } from './approval-policy/approval-policy.module';
import { RequestApprovalEmployeeModule } from './request-approval-employee/request-approval-employee.module';
import { RequestApprovalModule } from './request-approval/request-approval.module';
import { EventTypeModule } from './event-types/event-type.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PaymentModule } from './payment/payment.module';
import { CandidatePersonalQualitiesModule } from './candidate-personal-qualities/candidate-personal-qualities.module';
import { StageModule } from './pipeline-stage/pipeline-stage.module';
import { CandidateTechnologiesModule } from './candidate-technologies/candidate-technologies.module';
import { GoalModule } from './goal/goal.module';
import { KeyResultModule } from './keyresult/keyresult.module';
import { RequestApprovalTeamModule } from './request-approval-team/request-approval-team.module';
import { KeyResultUpdateModule } from './keyresult-update/keyresult-update.module';
import { CandidateCriterionsRatingModule } from './candidate-criterions-rating/candidate-criterion-rating.module';
import { GoalTimeFrameModule } from './goal-time-frame/goal-time-frame.module';
import { EstimateEmailModule } from './estimate-email/estimate-email.module';
import { TimeOffRequestModule } from './time-off-request/time-off-request.module';
import { DealModule } from './deal/deal.module';
import { OrganizationSprintModule } from './organization-sprint/organization-sprint.module';
import { GoalKpiModule } from './goal-kpi/goal-kpi.module';
import { GoalGeneralSettingModule } from './goal-general-setting/goal-general-setting.module';
import { EquipmentSharingPolicyModule } from './equipment-sharing-policy/equipment-sharing-policy.module';
import { GoalTemplateModule } from './goal-template/goal-template.module';
import { KeyresultTemplateModule } from './keyresult-template/keyresult-template.module';
import { EmployeeAwardModule } from './employee-award/employee-award.module';
import { InvoiceEstimateHistoryModule } from './invoice-estimate-history/invoice-estimate-history.module';
import { GoalKpiTemplateModule } from './goal-kpi-template/goal-kpi-template.module';
import { TenantSettingModule } from './tenant/tenant-setting/tenant-setting.module';
import { EmployeeJobPresetModule } from './employee-job-preset/employee-job-preset.module';
import { ReportModule } from './reports/report.module';
import { EmployeeProposalTemplateModule } from './employee-proposal-template/employee-proposal-template.module';
import { CustomSmtpModule } from './custom-smtp/custom-smtp.module';
import { FeatureModule } from './feature/feature.module';
import { ImageAssetModule } from './image-asset/image-asset.module';
import { resolveServeStaticPath } from './helper';
import { AccountingTemplateModule } from './accounting-template/accounting-template.module';
import { SeederModule } from './core/seeds/seeder.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { MerchantModule } from './merchant/merchant.module';
import { GauzyCloudModule } from './gauzy-cloud/gauzy-cloud.module';
import { ContactModule } from './contact/contact.module';
import { PublicShareModule } from './public-share/public-share.module';
import { TransformInterceptor } from './core/interceptors';

const { unleashConfig } = environment;

if (unleashConfig.url) {
	const unleashInstanceConfig: UnleashConfig = {
		appName: unleashConfig.appName,
		url: unleashConfig.url,
		instanceId: unleashConfig.instanceId,
		refreshInterval: unleashConfig.refreshInterval,
		metricsInterval: unleashConfig.metricsInterval,

		// we may disable Metrics completely in production or in demo env
		disableMetrics: false,

		// we may use Redis storage provider instead of in memory
		storageProvider: new InMemStorageProvider(),
	};

	if (unleashConfig.apiKey) {
		unleashInstanceConfig.customHeaders = {
			Authorization: unleashConfig.apiKey,
		};
	}

	console.log(
		`Using Unleash Config: ${JSON.stringify(unleashInstanceConfig)}`
	);

	const instance = initializeUnleash(unleashInstanceConfig);

	// metrics hooks
	instance.on('registered', (client) => {
		console.log('Unleash Client Registered');
	});

	instance.on('error', console.error);
	instance.on('warn', console.log);
} else {
	console.log(
		'Unleash Client Not Registered. UNLEASH_API_URL configuration is not provided.'
	);
}

const sentryIntegrations = [];

sentryIntegrations.push(
	// enable HTTP calls tracing
	new SentryIntegrations.Http({ tracing: true })
);

if (process.env.DB_TYPE === 'postgres') {
	sentryIntegrations.push(new TrackingIntegrations.Postgres());
}

@Module({
	imports: [
		ServeStaticModule.forRootAsync({
			useFactory: async (
				configService: ConfigService
			): Promise<ServeStaticModuleOptions[]> => {
				return await resolveServeStaticPath(configService);
			},
			inject: [ConfigService],
			imports: [],
		}),
		MulterModule.register(),
		I18nModule.forRoot({
			fallbackLanguage: LanguagesEnum.ENGLISH,
			loaderOptions: {
				path: path.resolve(__dirname, 'i18n/'),
				watch: !environment.production,
			},
			resolvers: [new HeaderResolver(['language'])],
		}),
		...(environment.sentry
			? [
					SentryModule.forRoot({
						dsn: environment.sentry.dns,
						debug: !environment.production,
						environment: environment.production
							? 'production'
							: 'development',
						// TODO: we should use some internal function which returns version of Gauzy
						release: 'gauzy@' + process.env.npm_package_version,
						logLevels: ['error'],
						integrations: sentryIntegrations,
						tracesSampleRate: 1.0,
					}),
			  ]
			: []),
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService): ThrottlerModuleOptions =>
				({
					ttl: config.get('THROTTLE_TTL'),
					limit: config.get('THROTTLE_LIMIT'),
				} as ThrottlerModuleOptions),
		}),
		CoreModule,
		AuthModule,
		UserModule,
		HomeModule,
		EmployeeModule,
		EmployeeRecurringExpenseModule,
		EmployeeAwardModule,
		CandidateModule,
		CandidateDocumentsModule,
		CandidateSourceModule,
		CandidateEducationModule,
		CandidateExperienceModule,
		CandidateSkillModule,
		CandidateFeedbacksModule,
		CandidateInterviewModule,
		CandidateInterviewersModule,
		CandidatePersonalQualitiesModule,
		CandidateTechnologiesModule,
		CandidateCriterionsRatingModule,
		CustomSmtpModule,
		ExportAllModule,
		ImportAllModule,
		EmployeeSettingModule,
		EmployeeJobPresetModule,
		EmployeeJobPostModule,
		EmployeeProposalTemplateModule,
		EmployeeStatisticsModule,
		EmployeeAppointmentModule,
		AppointmentEmployeesModule,
		RoleModule,
		OrganizationModule,
		IncomeModule,
		ExpenseModule,
		UserOrganizationModule,
		OrganizationDepartmentModule,
		OrganizationRecurringExpenseModule,
		OrganizationContactModule,
		OrganizationPositionModule,
		OrganizationProjectModule,
		OrganizationVendorModule,
		OrganizationAwardModule,
		OrganizationLanguageModule,
		OrganizationSprintModule,
		OrganizationTeamModule,
		OrganizationTeamEmployeeModule,
		OrganizationDocumentModule,
		RequestApprovalEmployeeModule,
		RequestApprovalTeamModule,
		ProposalModule,
		EmailModule,
		EmailTemplateModule,
		CountryModule,
		CurrencyModule,
		InviteModule,
		TimeOffPolicyModule,
		TimeOffRequestModule,
		ApprovalPolicyModule,
		EquipmentSharingPolicyModule,
		RequestApprovalModule,
		RolePermissionModule,
		TenantModule,
		TenantSettingModule,
		TagModule,
		SkillModule,
		StatusModule,
		LanguageModule,
		InvoiceModule,
		InvoiceItemModule,
		PaymentModule,
		EstimateEmailModule,
		GoalModule,
		GoalTimeFrameModule,
		GoalGeneralSettingModule,
		KeyResultModule,
		KeyResultUpdateModule,
		EmployeeLevelModule,
		EventTypeModule,
		AvailabilitySlotsModule,
		PipelineModule,
		StageModule,
		DealModule,
		InvoiceEstimateHistoryModule,
		EquipmentModule,
		EquipmentSharingModule,
		TaskModule,
		OrganizationEmploymentTypeModule,
		TimeTrackingModule,
		FeatureModule,
		ReportModule,
		UpworkModule,
		HubstaffModule,
		ExpenseCategoriesModule,
		ProductCategoryModule,
		ProductTypeModule,
		ProductModule,
		ImageAssetModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		IntegrationMapModule,
		ProductVariantPriceModule,
		ProductVariantModule,
		ProductVariantSettingModule,
		IntegrationEntitySettingModule,
		IntegrationEntitySettingTiedModule,
		GoalKpiModule,
		GoalTemplateModule,
		KeyresultTemplateModule,
		GoalKpiTemplateModule,
		AccountingTemplateModule,
		SeederModule,
		WarehouseModule,
		MerchantModule,
		GauzyCloudModule,
		ContactModule,
		PublicShareModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: TransformInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useFactory: () =>
				new SentryInterceptor({
					filters: [
						{
							type: HttpException,
							filter: (exception: HttpException) =>
								500 > exception.getStatus(), // Only report 500 errors
						},
					],
				}),
		},
	],
	exports: [],
})
export class AppModule {
	constructor() {
		// Set Monday as start of the week
		moment.locale(LanguagesEnum.ENGLISH, {
			week: {
				dow: 1,
			},
		});
		moment.locale(LanguagesEnum.ENGLISH);
	}
}
