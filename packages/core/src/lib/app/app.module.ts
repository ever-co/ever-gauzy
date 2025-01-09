import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule, ServeStaticModuleOptions } from '@nestjs/serve-static';
import { ClsModule, ClsService } from 'nestjs-cls';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { initialize as initializeUnleash, InMemStorageProvider, UnleashConfig } from 'unleash-client';
import * as chalk from 'chalk';
import * as path from 'path';
import * as moment from 'moment';
import { LanguagesEnum } from '@gauzy/contracts';
import { ConfigService, environment } from '@gauzy/config';
import { ThrottlerBehindProxyGuard } from '../throttler/throttler-behind-proxy.guard';
import { CoreModule } from '../core/core.module';
import { RequestContext } from '../core/context/request-context';
import { SharedModule } from '../shared/shared.module';
import { HealthModule } from '../health/health.module';
import { CandidateInterviewersModule } from '../candidate-interviewers/candidate-interviewers.module';
import { CandidateSkillModule } from '../candidate-skill/candidate-skill.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { InvoiceItemModule } from '../invoice-item/invoice-item.module';
import { TagModule } from '../tags/tag.module';
import { TaskStatusModule } from '../tasks/statuses/status.module';
import { TaskVersionModule } from '../tasks/versions/version.module';
import { SkillModule } from '../skills/skill.module';
import { LanguageModule } from '../language/language.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from '../user/user.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { OrganizationModule } from '../organization/organization.module';
import { IncomeModule } from '../income/income.module';
import { ExpenseModule } from '../expense/expense.module';
import { EmployeeSettingModule } from '../employee-setting/employee-setting.module';
import { EmployeeAppointmentModule } from '../employee-appointment/employee-appointment.module';
import { AuthModule } from '../auth/auth.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { EmployeeStatisticsModule } from '../employee-statistics/employee-statistics.module';
import { OrganizationDepartmentModule } from '../organization-department/organization-department.module';
import { OrganizationRecurringExpenseModule } from '../organization-recurring-expense/organization-recurring-expense.module';
import { EmployeeRecurringExpenseModule } from '../employee-recurring-expense/employee-recurring-expense.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { OrganizationPositionModule } from '../organization-position/organization-position.module';
import { OrganizationProjectModule } from '../organization-project/organization-project.module';
import { OrganizationVendorModule } from '../organization-vendor/organization-vendor.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { OrganizationTeamJoinRequestModule } from '../organization-team-join-request/organization-team-join-request.module';
import { OrganizationAwardModule } from '../organization-award/organization-award.module';
import { OrganizationLanguageModule } from '../organization-language/organization-language.module';
import { OrganizationDocumentModule } from '../organization-document/organization-document.module';
import { CountryModule } from '../country/country.module';
import { CurrencyModule } from '../currency/currency.module';
import { InviteModule } from '../invite/invite.module';
import { EmailHistoryModule } from '../email-history/email-history.module';
import { TimeOffPolicyModule } from '../time-off-policy/time-off-policy.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TenantModule } from '../tenant/tenant.module';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { EmployeeLevelModule } from '../employee-level/employee-level.module';
import { ExportModule } from '../export-import/export/export.module';
import { ImportModule } from '../export-import/import/import.module';
import { IssueTypeModule } from '../tasks/issue-type/issue-type.module';
import { TaskModule } from '../tasks/task.module';
import { TaskPriorityModule } from '../tasks/priorities/priority.module';
import { TaskRelatedIssueTypeModule } from '../tasks/related-issue-type/related-issue-type.module';
import { TaskSizeModule } from '../tasks/sizes/size.module';
import { EquipmentSharingModule } from '../equipment-sharing/equipment-sharing.module';
import { OrganizationEmploymentTypeModule } from '../organization-employment-type/organization-employment-type.module';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { ExpenseCategoriesModule } from '../expense-categories/expense-categories.module';
import { CandidateModule } from '../candidate/candidate.module';
import { ProductCategoryModule } from '../product-category/product-category.module';
import { ProductTypeModule } from '../product-type/product-type.module';
import { ProductModule } from '../product/product.module';
import { IntegrationSettingModule } from '../integration-setting/integration-setting.module';
import { IntegrationMapModule } from '../integration-map/integration-map.module';
import { ProductVariantPriceModule } from '../product-variant-price/product-variant-price-module';
import { ProductVariantModule } from '../product-variant/product-variant.module';
import { IntegrationEntitySettingModule } from '../integration-entity-setting/integration-entity-setting.module';
import { IntegrationEntitySettingTiedModule } from '../integration-entity-setting-tied/integration-entity-setting-tied.module';
import { CandidateEducationModule } from '../candidate-education/candidate-education.module';
import { CandidateSourceModule } from '../candidate-source/candidate-source.module';
import { CandidateDocumentsModule } from '../candidate-documents/candidate-documents.module';
import { CandidateExperienceModule } from '../candidate-experience/candidate-experience.module';
import { CandidateFeedbacksModule } from '../candidate-feedbacks/candidate-feedbacks.module';
import { ProductVariantSettingModule } from '../product-setting/product-setting.module';
import { IntegrationModule } from '../integration/integration.module';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { CandidateInterviewModule } from '../candidate-interview/candidate-interview.module';
import { AppointmentEmployeesModule } from '../appointment-employees/appointment-employees.module';
import { ApprovalPolicyModule } from '../approval-policy/approval-policy.module';
import { RequestApprovalEmployeeModule } from '../request-approval-employee/request-approval-employee.module';
import { RequestApprovalModule } from '../request-approval/request-approval.module';
import { EventTypeModule } from '../event-types/event-type.module';
import { AvailabilitySlotsModule } from '../availability-slots/availability-slots.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { PaymentModule } from '../payment/payment.module';
import { CandidatePersonalQualitiesModule } from '../candidate-personal-qualities/candidate-personal-qualities.module';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { CandidateTechnologiesModule } from '../candidate-technologies/candidate-technologies.module';
import { GoalModule } from '../goal/goal.module';
import { KeyResultModule } from '../keyresult/keyresult.module';
import { RequestApprovalTeamModule } from '../request-approval-team/request-approval-team.module';
import { KeyResultUpdateModule } from '../keyresult-update/keyresult-update.module';
import { CandidateCriterionsRatingModule } from '../candidate-criterions-rating/candidate-criterion-rating.module';
import { GoalTimeFrameModule } from '../goal-time-frame/goal-time-frame.module';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { TimeOffRequestModule } from '../time-off-request/time-off-request.module';
import { DealModule } from '../deal/deal.module';
import { OrganizationSprintModule } from '../organization-sprint/organization-sprint.module';
import { GoalKpiModule } from '../goal-kpi/goal-kpi.module';
import { GoalGeneralSettingModule } from '../goal-general-setting/goal-general-setting.module';
import { EquipmentSharingPolicyModule } from '../equipment-sharing-policy/equipment-sharing-policy.module';
import { GoalTemplateModule } from '../goal-template/goal-template.module';
import { KeyresultTemplateModule } from '../keyresult-template/keyresult-template.module';
import { EmployeeAwardModule } from '../employee-award/employee-award.module';
import { InvoiceEstimateHistoryModule } from '../invoice-estimate-history/invoice-estimate-history.module';
import { GoalKpiTemplateModule } from '../goal-kpi-template/goal-kpi-template.module';
import { TenantSettingModule } from '../tenant/tenant-setting/tenant-setting.module';
import { ReportModule } from '../reports/report.module';
import { CustomSmtpModule } from '../custom-smtp/custom-smtp.module';
import { FeatureModule } from '../feature/feature.module';
import { ImageAssetModule } from '../image-asset/image-asset.module';
import { resolveServeStaticPath } from '../helper';
import { AccountingTemplateModule } from '../accounting-template/accounting-template.module';
import { SeederModule } from '../core/seeds/seeder.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { MerchantModule } from '../merchant/merchant.module';
import { GauzyCloudModule } from '../gauzy-cloud/gauzy-cloud.module';
import { ContactModule } from '../contact/contact.module';
import { PublicShareModule } from '../public-share/public-share.module';
import { TransformInterceptor } from '../core/interceptors';
import { EmailResetModule } from '../email-reset/email-reset.module';
import { TaskLinkedIssueModule } from '../tasks/linked-issue/task-linked-issue.module';
import { OrganizationTaskSettingModule } from '../organization-task-setting/organization-task-setting.module';
import { TaskEstimationModule } from '../tasks/estimation/task-estimation.module';
import { DailyPlanModule } from '../tasks/daily-plan/daily-plan.module';
import { ScreeningTasksModule } from '../tasks/screening-tasks/screening-tasks.module';
import { SocialAccountModule } from '../auth/social-account/social-account.module';
import { OrganizationProjectModuleModule } from '../organization-project-module/organization-project-module.module';
import { FavoriteModule } from '../favorite/favorite.module';
import { GlobalFavoriteModule } from '../favorite/global-favorite-service.module';
import { CommentModule } from '../comment/comment.module';
import { StatsModule } from '../stats/stats.module'; // Global Stats Module
import { ReactionModule } from '../reaction/reaction.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ApiCallLogModule } from '../api-call-log/api-call-log.module'; // Global Api Call Log Module
import { TaskViewModule } from '../tasks/views/view.module';
import { ResourceLinkModule } from '../resource-link/resource-link.module';
import { MentionModule } from '../mention/mention.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DashboardWidgetModule } from '../dashboard/dashboard-widget/dashboard-widget.module';
import { TagTypeModule } from '../tag-type';
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
		storageProvider: new InMemStorageProvider()
	};

	if (unleashConfig.apiKey) {
		unleashInstanceConfig.customHeaders = {
			Authorization: unleashConfig.apiKey
		};
	}

	console.log(`Using Unleash Config: ${JSON.stringify(unleashInstanceConfig)}`);

	const instance = initializeUnleash(unleashInstanceConfig);

	// metrics hooks
	instance.on('registered', (client) => {
		console.log('Unleash Client Registered');
	});

	instance.on('error', console.error);
	instance.on('warn', console.log);
} else {
	console.log('Unleash Client Not Registered. UNLEASH_API_URL configuration is not provided.');
}

if (environment.THROTTLE_ENABLED) {
	console.log('Throttle Enabled');

	const ttlValue = environment.THROTTLE_TTL;
	console.log('Throttle TTL: ', ttlValue);

	const limit = environment.THROTTLE_LIMIT;
	console.log('Throttle Limit: ', limit);
}

@Module({
	imports: [
		ClsModule.forRoot({
			global: true,
			middleware: { mount: false }
		}),
		...(process.env.REDIS_ENABLED === 'true'
			? [
					CacheModule.registerAsync({
						isGlobal: true,
						useFactory: async () => {
							const url =
								process.env.REDIS_URL ||
								(process.env.REDIS_TLS === 'true'
									? `rediss://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
									: `redis://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

							console.log('REDIS_URL: ', url);

							let host, port, username, password;

							const isTls = url.startsWith('rediss://');

							// Removing the protocol part
							let authPart = url.split('://')[1];

							// Check if the URL contains '@' (indicating the presence of username/password)
							if (authPart.includes('@')) {
								// Splitting user:password and host:port
								let [userPass, hostPort] = authPart.split('@');
								[username, password] = userPass.split(':');
								[host, port] = hostPort.split(':');
							} else {
								// If there is no '@', it means there is no username/password
								[host, port] = authPart.split(':');
							}

							port = parseInt(port);

							const storeOptions = {
								url: url,
								username: username,
								password: password,
								isolationPoolOptions: {
									min: 1,
									max: 100
								},
								socket: {
									tls: isTls,
									host: host,
									port: port,
									passphrase: password,
									rejectUnauthorized: process.env.NODE_ENV === 'production'
								},
								ttl: 60 * 60 * 24 * 7 // 1 week,
							};

							const store = await redisStore(storeOptions);

							store.client
								.on('error', (err) => {
									console.log('Redis Cache Client Error: ', err);
								})
								.on('connect', () => {
									console.log('Redis Cache Client Connected');
								})
								.on('ready', () => {
									console.log('Redis Cache Client Ready');
								})
								.on('reconnecting', () => {
									console.log('Redis Cache Client Reconnecting');
								})
								.on('end', () => {
									console.log('Redis Cache Client End');
								});

							// ping Redis
							const res = await store.client.ping();
							console.log('Redis Cache Client Cache Ping: ', res);

							return {
								store: () => store
							};
						}
					})
			  ]
			: [CacheModule.register({ isGlobal: true })]),
		// Serve Static Module Configuration
		ServeStaticModule.forRootAsync({
			useFactory: async (config: ConfigService): Promise<ServeStaticModuleOptions[]> => {
				console.log(chalk.green(`✔ Serve Static Config -> process.cwd: ${process.cwd()}`));
				return await resolveServeStaticPath(config);
			},
			inject: [ConfigService]
		}),
		MulterModule.register(),
		I18nModule.forRoot({
			fallbackLanguage: LanguagesEnum.ENGLISH,
			loaderOptions: {
				path: path.resolve(__dirname, '../i18n/'),
				watch: !environment.production
			},
			resolvers: [new HeaderResolver(['language'])]
		}),
		...(environment.THROTTLE_ENABLED
			? [
					ThrottlerModule.forRootAsync({
						inject: [ConfigService],
						useFactory: () => {
							return [
								{
									ttl: environment.THROTTLE_TTL,
									limit: environment.THROTTLE_LIMIT
								}
							];
						}
					})
			  ]
			: []),
		HealthModule,
		CoreModule,
		SharedModule,
		AuthModule,
		UserModule,
		SocialAccountModule,
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
		ExportModule,
		ImportModule,
		EmployeeSettingModule,
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
		OrganizationProjectModuleModule,
		OrganizationVendorModule,
		OrganizationAwardModule,
		OrganizationLanguageModule,
		OrganizationSprintModule,
		OrganizationTeamModule,
		OrganizationTeamEmployeeModule,
		OrganizationTeamJoinRequestModule,
		OrganizationDocumentModule,
		RequestApprovalEmployeeModule,
		RequestApprovalTeamModule,
		EmailHistoryModule,
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
		TagTypeModule,
		SkillModule,
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
		TaskPriorityModule,
		TaskRelatedIssueTypeModule,
		TaskSizeModule,
		TaskStatusModule,
		TaskVersionModule,
		DailyPlanModule,
		ScreeningTasksModule,
		OrganizationEmploymentTypeModule,
		TimeTrackingModule,
		FeatureModule,
		ReportModule,
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
		EmailResetModule,
		IssueTypeModule,
		TaskLinkedIssueModule,
		OrganizationTaskSettingModule,
		TaskEstimationModule,
		FavoriteModule,
		GlobalFavoriteModule,
		StatsModule,
		ReactionModule,
		CommentModule,
		ActivityLogModule,
		ApiCallLogModule,
		TaskViewModule,
		ResourceLinkModule,
		MentionModule,
		SubscriptionModule,
		DashboardModule,
		DashboardWidgetModule
	],
	controllers: [AppController],
	providers: [
		AppService,
		...(environment.THROTTLE_ENABLED
			? [
					{
						provide: APP_GUARD,
						useClass: ThrottlerBehindProxyGuard
					}
			  ]
			: []),
		{
			provide: APP_INTERCEPTOR,
			useClass: TransformInterceptor
		}
	],
	exports: []
})
export class AppModule implements OnModuleInit {
	constructor(private readonly clsService: ClsService) {
		// Set Monday as start of the week
		moment.updateLocale(LanguagesEnum.ENGLISH, {
			week: { dow: 1 }
		});
	}

	onModuleInit() {
		// Set the ClsService in RequestContext one time on app start before any request
		RequestContext.setClsService(this.clsService);
		console.log('AppModule initialized, ClsService set in RequestContext.');
	}
}
