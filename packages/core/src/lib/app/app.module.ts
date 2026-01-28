import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule, ServeStaticModuleOptions } from '@nestjs/serve-static';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Cacheable, CacheableMemory } from 'cacheable';
import { createKeyvNonBlocking } from '@keyv/redis';
import { Keyv } from 'keyv';
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
import { ValidatorModule } from '../shared/validators/validator.module';
import { ApiKeyAuthGuard } from '../shared/guards/api-key-auth.guard';
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
import { AppBootstrapLogger } from './app-bootstrap-logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailCheckModule } from '../email-check/email-check.module';
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
import { EntitySubscriptionModule } from '../entity-subscription/entity-subscription.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DashboardWidgetModule } from '../dashboard/dashboard-widget/dashboard-widget.module';
import { TenantApiKeyModule } from '../tenant-api-key/tenant-api-key.module';
import { TagTypeModule } from '../tag-type/tag-type.module';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { EmployeeNotificationSettingModule } from '../employee-notification-setting/employee-notification-setting.module';
import { EmployeeRecentVisitModule } from '../employee-recent-visit/employee-recent-visit.module';
import { SharedEntityModule } from '../shared-entity/shared-entity.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { OrganizationStrategicInitiativeModule } from '../organization-strategic-initiative/organization-strategic-initiative.module';
import { PasswordHashModule } from '../password-hash/password-hash.module';

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
	instance.on('registered', () => {
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
		// Cache Module Configuration with 2-layer caching (in-memory L1 + Redis L2)
		...(process.env.REDIS_ENABLED === 'true'
			? [
					NestCacheModule.registerAsync({
						isGlobal: true,
						useFactory: async () => {
							// Build Redis URL from environment variables
							const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD, REDIS_TLS } =
								process.env;

							// Validate Redis configuration
							if (!REDIS_URL && (!REDIS_HOST || !REDIS_PORT)) {
								console.warn(
									'Redis is enabled but neither REDIS_URL nor REDIS_HOST/REDIS_PORT are configured. Falling back to in-memory cache.'
								);
								// Return in-memory cache configuration (no store specified = default in-memory)
								return {};
							}

							// Construct Redis URL
							const url =
								REDIS_URL ||
								(() => {
									const redisProtocol = REDIS_TLS === 'true' ? 'rediss' : 'redis';
									const auth = REDIS_USER && REDIS_PASSWORD ? `${REDIS_USER}:${REDIS_PASSWORD}@` : '';
									return `${redisProtocol}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
								})();

							try {
								// Parse Redis URL
								const parsedUrl = new URL(url);
								const isTls = parsedUrl.protocol === 'rediss:';
								const username = parsedUrl.username || REDIS_USER;
								const password = parsedUrl.password || REDIS_PASSWORD || undefined;
								const host = parsedUrl.hostname || REDIS_HOST;
								const port = parseInt(parsedUrl.port || REDIS_PORT || '6379', 10);

								const primary = new Keyv({
									store: new CacheableMemory({ ttl: '1h', lruSize: 10000 })
								});
								// Create non-blocking Redis secondary store using helper function
								// This automatically configures:
								// - disableOfflineQueue: true
								// - socket.reconnectStrategy: false (overrides any custom strategy)
								// - throwOnConnectError: false

								const secondary = createKeyvNonBlocking({
									url,
									username,
									password,
									socket: isTls
										? {
												// TLS socket options (RedisTlsOptions)
												host,
												port,
												tls: true,
												rejectUnauthorized: process.env.NODE_ENV === 'production',
												// Connection timeout
												connectTimeout: 10_000
										  }
										: {
												// TCP socket options (RedisTcpOptions)
												host,
												port,
												// TCP keepalive (value in milliseconds for initial delay)
												keepAlive: true,
												keepAliveInitialDelay: 10_000,
												// Connection timeout
												connectTimeout: 10_000
										  },
									// Send PING every 30s to keep connection alive
									pingInterval: 30_000
								});

								// Create Cacheable instance with 2-layer caching
								// Note: The Cacheable instance is prepared for future use but cache-manager currently
								// uses the raw Keyv stores directly, bypassing Cacheable's coordination features.
								// For full non-blocking semantics, a dedicated CacheService could use cacheable directly
								const cacheable = new Cacheable({
									primary,
									// Layer 2: Redis secondary store (non-blocking)
									secondary,
									// Enable non-blocking mode (critical!)
									// Writes to Redis happen in background, reads check primary first
									nonBlocking: true,
									// Default TTL: 1 week
									ttl: '7d'
								});

								console.log('✓ Redis cache configured successfully (2-layer: in-memory + Redis)');

								// Wrap cacheable to ensure type compatibility with cache-manager
								// This provides proper type safety without 'as any' cast

								return {
									stores: cacheable
								};
							} catch (error) {
								console.error(
									'Failed to configure Redis cache, falling back to in-memory cache:',
									error.message
								);
								// Return in-memory cache configuration as fallback
								// This ensures cache operations continue to work even if Redis fails
								return {};
							}
						}
					})
			  ]
			: [NestCacheModule.register({ isGlobal: true })]),
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
				path:
					environment.isElectron && environment.electronResourcesPath
						? path.resolve(
								environment.electronResourcesPath,
								'app.asar.unpacked/node_modules/@gauzy/core/src/lib/i18n'
						  )
						: path.resolve(__dirname, '../i18n/'),
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
		ValidatorModule,
		AuthModule,
		EmailCheckModule,
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
		EntitySubscriptionModule,
		DashboardModule,
		DashboardWidgetModule,
		EmployeeNotificationModule,
		EmployeeNotificationSettingModule,
		TenantApiKeyModule,
		EmployeeRecentVisitModule,
		SharedEntityModule,
		BroadcastModule,
		OrganizationStrategicInitiativeModule,
		PasswordHashModule
	],
	controllers: [AppController],
	providers: [
		AppService,
		AppBootstrapLogger,
		ApiKeyAuthGuard,
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
	]
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
