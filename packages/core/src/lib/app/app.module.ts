import { ConfigService, environment } from '@gauzy/config';
import { LanguagesEnum } from '@gauzy/contracts';
import { isSchedulerQueueRootEnabled, SchedulerModule } from '@gauzy/scheduler';
import { createKeyvNonBlocking } from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { ServeStaticModule, ServeStaticModuleOptions } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { createClient as createRedisClient } from 'redis';
import { Cacheable, CacheableMemory } from 'cacheable';
import * as chalk from 'chalk';
import { EVER_REDIS_CLIENT, RedisModule } from '../redis/redis.module';
import { Keyv } from 'keyv';
import * as moment from 'moment';
import { ClsModule, ClsService } from 'nestjs-cls';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import { initialize as initializeUnleash, InMemStorageProvider, UnleashConfig } from 'unleash-client';
import { AccessTokenModule } from '../access-token/access-token.module';
import { AccountingTemplateModule } from '../accounting-template/accounting-template.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AdjustmentModule } from '../adjustment/adjustment.module';
import { ApiCallLogModule } from '../api-call-log/api-call-log.module'; // Global Api Call Log Module
import { AppointmentEmployeesModule } from '../appointment-employees/appointment-employees.module';
import { ApprovalPolicyModule } from '../approval-policy/approval-policy.module';
import { AuthModule } from '../auth/auth.module';
import { SocialAccountModule } from '../auth/social-account/social-account.module';
import { AvailabilitySlotsModule } from '../availability-slots/availability-slots.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { CandidateCriterionsRatingModule } from '../candidate-criterions-rating/candidate-criterion-rating.module';
import { CandidateDocumentsModule } from '../candidate-documents/candidate-documents.module';
import { CandidateEducationModule } from '../candidate-education/candidate-education.module';
import { CandidateExperienceModule } from '../candidate-experience/candidate-experience.module';
import { CandidateFeedbacksModule } from '../candidate-feedbacks/candidate-feedbacks.module';
import { CandidateInterviewModule } from '../candidate-interview/candidate-interview.module';
import { CandidateInterviewersModule } from '../candidate-interviewers/candidate-interviewers.module';
import { CandidatePersonalQualitiesModule } from '../candidate-personal-qualities/candidate-personal-qualities.module';
import { CandidateSkillModule } from '../candidate-skill/candidate-skill.module';
import { CandidateSourceModule } from '../candidate-source/candidate-source.module';
import { CandidateTechnologiesModule } from '../candidate-technologies/candidate-technologies.module';
import { CandidateModule } from '../candidate/candidate.module';
import { CommentModule } from '../comment/comment.module';
import { ContactModule } from '../contact/contact.module';
import { RequestContext } from '../core/context/request-context';
import { CoreModule } from '../core/core.module';
import { TransformInterceptor } from '../core/interceptors';
import { SeederModule } from '../core/seeds/seeder.module';
import { CountryModule } from '../country/country.module';
import { CurrencyModule } from '../currency/currency.module';
import { CustomSmtpModule } from '../custom-smtp/custom-smtp.module';
import { DashboardWidgetModule } from '../dashboard/dashboard-widget/dashboard-widget.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DealModule } from '../deal/deal.module';
import { EmailCheckModule } from '../email-check/email-check.module';
import { EmailHistoryModule } from '../email-history/email-history.module';
import { EmailResetModule } from '../email-reset/email-reset.module';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { EmployeeAppointmentModule } from '../employee-appointment/employee-appointment.module';
import { EmployeeAvailabilityModule } from '../employee-availability/employee-availability.module';
import { EmployeeAwardModule } from '../employee-award/employee-award.module';
import { EmployeeLevelModule } from '../employee-level/employee-level.module';
import { EmployeeNotificationSettingModule } from '../employee-notification-setting/employee-notification-setting.module';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { EmployeeRecentVisitModule } from '../employee-recent-visit/employee-recent-visit.module';
import { EmployeeRecurringExpenseModule } from '../employee-recurring-expense/employee-recurring-expense.module';
import { EmployeeSettingModule } from '../employee-setting/employee-setting.module';
import { EmployeeStatisticsModule } from '../employee-statistics/employee-statistics.module';
import { EmployeeModule } from '../employee/employee.module';
import { EntitySubscriptionModule } from '../entity-subscription/entity-subscription.module';
import { EquipmentSharingPolicyModule } from '../equipment-sharing-policy/equipment-sharing-policy.module';
import { EquipmentSharingModule } from '../equipment-sharing/equipment-sharing.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { EventTypeModule } from '../event-types/event-type.module';
import { ExpenseCategoriesModule } from '../expense-categories/expense-categories.module';
import { ExpenseModule } from '../expense/expense.module';
import { ExportModule } from '../export-import/export/export.module';
import { ImportModule } from '../export-import/import/import.module';
import { FavoriteModule } from '../favorite/favorite.module';
import { GlobalFavoriteModule } from '../favorite/global-favorite-service.module';
import { FeatureModule } from '../feature/feature.module';
import { GauzyCloudModule } from '../gauzy-cloud/gauzy-cloud.module';
import { GoalGeneralSettingModule } from '../goal-general-setting/goal-general-setting.module';
import { GoalKpiTemplateModule } from '../goal-kpi-template/goal-kpi-template.module';
import { GoalKpiModule } from '../goal-kpi/goal-kpi.module';
import { GoalTemplateModule } from '../goal-template/goal-template.module';
import { GoalTimeFrameModule } from '../goal-time-frame/goal-time-frame.module';
import { GoalModule } from '../goal/goal.module';
import { HealthModule } from '../health/health.module';
import { resolveServeStaticPath } from '../helper';
import { ImageAssetModule } from '../image-asset/image-asset.module';
import { IncomeModule } from '../income/income.module';
import { IntegrationEntitySettingTiedModule } from '../integration-entity-setting-tied/integration-entity-setting-tied.module';
import { IntegrationEntitySettingModule } from '../integration-entity-setting/integration-entity-setting.module';
import { IntegrationMapModule } from '../integration-map/integration-map.module';
import { IntegrationSettingModule } from '../integration-setting/integration-setting.module';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { IntegrationModule } from '../integration/integration.module';
import { InviteModule } from '../invite/invite.module';
import { InvoiceEstimateHistoryModule } from '../invoice-estimate-history/invoice-estimate-history.module';
import { InvoiceItemModule } from '../invoice-item/invoice-item.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { KeyresultTemplateModule } from '../keyresult-template/keyresult-template.module';
import { KeyResultUpdateModule } from '../keyresult-update/keyresult-update.module';
import { KeyResultModule } from '../keyresult/keyresult.module';
import { LanguageModule } from '../language/language.module';
import { MentionModule } from '../mention/mention.module';
import { MerchantModule } from '../merchant/merchant.module';
import { MoneyModule } from '../money/money.module';
import { OrganizationAwardModule } from '../organization-award/organization-award.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { OrganizationDepartmentModule } from '../organization-department/organization-department.module';
import { OrganizationDocumentModule } from '../organization-document/organization-document.module';
import { OrganizationEmploymentTypeModule } from '../organization-employment-type/organization-employment-type.module';
import { OrganizationLanguageModule } from '../organization-language/organization-language.module';
import { OrganizationPositionModule } from '../organization-position/organization-position.module';
import { OrganizationProjectModuleModule } from '../organization-project-module/organization-project-module.module';
import { OrganizationProjectModule } from '../organization-project/organization-project.module';
import { OrganizationRecurringExpenseModule } from '../organization-recurring-expense/organization-recurring-expense.module';
import { OrganizationSprintModule } from '../organization-sprint/organization-sprint.module';
import { OrganizationStrategicInitiativeModule } from '../organization-strategic-initiative/organization-strategic-initiative.module';
import { OrganizationTaskSettingModule } from '../organization-task-setting/organization-task-setting.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { OrganizationTeamJoinRequestModule } from '../organization-team-join-request/organization-team-join-request.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { OrganizationVendorModule } from '../organization-vendor/organization-vendor.module';
import { OrganizationModule } from '../organization/organization.module';
import { PasswordHashModule } from '../password-hash/password-hash.module';
import { PaymentModule } from '../payment/payment.module';
import { PayrollRunModule } from '../payroll-run/payroll-run.module';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ProductCategoryModule } from '../product-category/product-category.module';
import { ProductVariantSettingModule } from '../product-setting/product-setting.module';
import { ProductTypeModule } from '../product-type/product-type.module';
import { ProductVariantPriceModule } from '../product-variant-price/product-variant-price-module';
import { ProductVariantModule } from '../product-variant/product-variant.module';
import { ProductModule } from '../product/product.module';
import { PublicShareModule } from '../public-share/public-share.module';
import { ReactionModule } from '../reaction/reaction.module';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module';
import { ReportModule } from '../reports/report.module';
import { RequestApprovalEmployeeModule } from '../request-approval-employee/request-approval-employee.module';
import { RequestApprovalTeamModule } from '../request-approval-team/request-approval-team.module';
import { RequestApprovalModule } from '../request-approval/request-approval.module';
import { ResourceLinkModule } from '../resource-link/resource-link.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { PluginContributionModule } from '../plugin-contributions/plugin-contribution.module';
import { RuleModule } from '../rule/rule.module';
import { SequenceModule } from '../sequence/sequence.module';
import { SearchModule } from '../search/search.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { IdempotencyMaintenanceModule } from '../idempotency/idempotency-maintenance.module';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { EventOutboxModule } from '../event-outbox/event-outbox.module';
import { EventOutboxMaintenanceModule } from '../event-outbox/event-outbox-maintenance.module';
import { WebhookMaintenanceModule } from '../webhook/webhook-maintenance.module';
import { OperationModule } from '../operation/operation.module';
import { WebhookModule } from '../webhook/webhook.module';
import { MeasurementModule } from '../measurement/measurement.module';
import { PaymentTermModule } from '../payment-term/payment-term.module';
import { AddressRoleModule } from '../address-role/address-role.module';
import { GraphqlSubscriptionModule } from '../graphql/subscriptions/graphql-subscription.module';
import { RoleModule } from '../role/role.module';
import { SharedEntityModule } from '../shared-entity/shared-entity.module';
import { ApiKeyAuthGuard } from '../shared/guards/api-key-auth.guard';
import { ValidatorModule } from '../shared/validators/validator.module';
import { SkillModule } from '../skills/skill.module';
import { StatsModule } from '../stats/stats.module'; // Global Stats Module
import { TagTypeModule } from '../tag-type/tag-type.module';
import { TagModule } from '../tags/tag.module';
import { DailyPlanModule } from '../tasks/daily-plan/daily-plan.module';
import { TaskEstimationModule } from '../tasks/estimation/task-estimation.module';
import { IssueTypeModule } from '../tasks/issue-type/issue-type.module';
import { TaskMetadataBootstrapModule } from '../tasks/task-metadata-bootstrap';
import { TaskLinkedIssueModule } from '../tasks/linked-issue/task-linked-issue.module';
import { TaskPriorityModule } from '../tasks/priorities/priority.module';
import { TaskRelatedIssueTypeModule } from '../tasks/related-issue-type/related-issue-type.module';
import { ScreeningTasksModule } from '../tasks/screening-tasks/screening-tasks.module';
import { TaskSizeModule } from '../tasks/sizes/size.module';
import { TaskStatusModule } from '../tasks/statuses/status.module';
import { TaskModule } from '../tasks/task.module';
import { TaskVersionModule } from '../tasks/versions/version.module';
import { TaskViewModule } from '../tasks/views/view.module';
import { TaxLineModule } from '../tax-line/tax-line.module';
import { OAuthClientModule } from '../auth/oauth-client/oauth-client.module';
import { TenantApiKeyModule } from '../tenant-api-key/tenant-api-key.module';
import { TenantSettingModule } from '../tenant/tenant-setting/tenant-setting.module';
import { TenantModule } from '../tenant/tenant.module';
import { BillingModule } from '../shared/billing';
import { createThrottlerStorage } from '../throttler/redis-throttler.storage';
import { ThrottlerBehindProxyGuard } from '../throttler/throttler-behind-proxy.guard';
import { OfficialHolidayModule } from '../official-holiday/official-holiday.module';
import { TimeOffBalanceModule } from '../time-off-balance/time-off-balance.module';
import { TimeOffPolicyModule } from '../time-off-policy/time-off-policy.module';
import { TimeOffRequestModule } from '../time-off-request/time-off-request.module';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { TokenModule } from '../token/token.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { UserModule } from '../user/user.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { AppBootstrapLogger } from './app-bootstrap-logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { describeUnleashConfig } from './unleash-config-log';

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

	// The Unleash API key travels in `customHeaders.Authorization` - never serialize the config as-is.
	console.log(describeUnleashConfig(unleashInstanceConfig));

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
		// Redis client for atomic operations (e.g. GETDEL for single-use OAuth codes)
		RedisModule,
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
						imports: [RedisModule],
						inject: [EVER_REDIS_CLIENT],
						// Buckets live in Redis when one is configured, so the configured limit holds
						// across every API replica instead of being multiplied by the replica count and
						// reset by every rollout. Without Redis this resolves to `undefined` and the
						// module keeps its own per-process store.
						useFactory: (redisClient: ReturnType<typeof createRedisClient> | null) => {
							const storage = createThrottlerStorage(redisClient);

							return {
								throttlers: [
									{
										ttl: environment.THROTTLE_TTL,
										limit: environment.THROTTLE_LIMIT
									}
								],
								...(storage ? { storage } : {})
							};
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
		// The availability resource's module, which nothing imported until its GraphQL surface existed: a
		// module that is not in the application's graph is not mounted, so its REST routes answered 404 and
		// its resolver was never scanned — the endpoint carried the fields its SDL declares and resolved
		// every one of them to null, with no error anywhere. Naming it here is what mounts both surfaces.
		EmployeeAvailabilityModule,
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
		OfficialHolidayModule,
		TimeOffBalanceModule,
		TimeOffPolicyModule,
		TimeOffRequestModule,
		ApprovalPolicyModule,
		EquipmentSharingPolicyModule,
		RequestApprovalModule,
		RolePermissionModule,
		PluginContributionModule,
		SequenceModule,
		// Platform search. The index tables are core because the platform searches contacts,
		// invoices, expenses, products, orders, projects, tasks, employees and documents alike —
		// the search plugin owns the pipeline and the providers, core owns the schema.
		SearchModule,
		// Kernel capabilities every domain above builds on: one rule engine, one money-adjustment ledger,
		// one tax ledger, and the money layer the three of them round through.
		RuleModule,
		AdjustmentModule,
		TaxLineModule,
		MoneyModule,
		// The event kernel: retryable requests, the transactional outbox, the durable-operation runtime
		// and outbound delivery. Each is read by any domain that changes state and emits a fact.
		IdempotencyModule,
		EventOutboxModule,
		OperationModule,
		WebhookModule,
		// What a number means and when a document is settled. The measurement families are read by
		// inventory, purchasing, projects and time tracking alike, a settlement term is read by the
		// accounting document and by procurement, and an address role is a dimension of the address book —
		// so all three are kernel capabilities with their own guarded routes rather than fields on a
		// resource some other module owns.
		MeasurementModule,
		PaymentTermModule,
		AddressRoleModule,
		// The subscription surface: the fan-out, the catalogue of streamable events, the delivery
		// decision, and the two routes an event takes to a subscriber — the outbox consumer for a
		// durable fact and the bus bridge for a domain that publishes in process. Adding it changes
		// no existing route.
		GraphqlSubscriptionModule,
		TenantModule,
		TenantSettingModule,
		// In-product billing pages. Every route inside 404s unless STRIPE_SECRET_KEY is set, so a
		// self-hosted install carries the module but exposes no billing surface.
		BillingModule,
		TagModule,
		TagTypeModule,
		SkillModule,
		LanguageModule,
		InvoiceModule,
		InvoiceItemModule,
		PaymentModule,
		PayrollRunModule,
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
		TaskMetadataBootstrapModule,
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
		OAuthClientModule,
		EmployeeRecentVisitModule,
		SharedEntityModule,
		BroadcastModule,
		OrganizationStrategicInitiativeModule,
		PasswordHashModule,
		/**
		 * PRODUCER-ONLY BullMQ root for the API process.
		 *
		 * Why it exists: plugins that offload work (today the Documents pipeline) can only reach
		 * BullMQ through `SchedulerQueueService`, and that provider only exists where a
		 * `SchedulerModule.forRoot()` was imported. Until this line the API had none, so every
		 * `extract → classify → chunk → embed → index` stage — plus OCR and thumbnails — ran
		 * INLINE in the API process while `apps/worker` sat idle.
		 *
		 * The two halves are deliberately split:
		 * - `enableQueueing: true`  → registers `BullModule.forRoot()`, i.e. the connection that
		 *   makes `SchedulerQueueService` resolvable and lets this process ENQUEUE.
		 * - 🛑 `enabled: false`     → the job-runner half stays OFF. `SchedulerDiscoveryService`
		 *   still discovers `@ScheduledJob` methods but `registerSchedules()` skips every one of
		 *   them (`if (!job.options.enabled || !this.moduleOptions.enabled) continue`), and
		 *   `SchedulerJobRunnerService.execute()` returns immediately, which also neuters the
		 *   `runOnStart` path. `apps/worker` owns scheduled jobs; if the API ran them too, every
		 *   scheduled job would execute twice.
		 * - `logRegisteredJobs: false` → discovery would otherwise log "Registered scheduled job"
		 *   for jobs this process will never fire.
		 *
		 * 🛑 Conditional by design — with `REDIS_ENABLED` unset there is NO root at all and every
		 * consumer keeps its in-process fallback (the Documents plugin dispatches stages inline).
		 * That is the path single-container and dev setups run on and it must keep working.
		 * `SCHEDULER_QUEUE_ENABLED=false` forces it off even where Redis is configured.
		 */
		...(isSchedulerQueueRootEnabled()
			? [
					SchedulerModule.forRoot({
						enabled: false,
						enableQueueing: true,
						logRegisteredJobs: false
					}),
					// The hourly sweep over the retry keys travels on that queue, so it is registered exactly
					// when the queue exists. A scheduled job needs a worker, a worker needs a connection, and
					// registering one where there is no root is not a degraded sweep — it is a boot that fails
					// on `Worker requires a connection`, which is what a single-container dev setup would meet.
					IdempotencyMaintenanceModule,
					// The per-minute pass that drains the transactional outbox, registered under the same
					// condition and for the same reason. 🛑 Note what its absence means, because it is not the
					// same as the sweep's: without a queue root nothing hands appended events to their
					// consumers, so GraphQL subscriptions, the search index and every outbound webhook go
					// quiet while `event_outbox` grows. Appending still works and no writer sees an error —
					// which is exactly why this is called out here rather than left to be discovered. A
					// deployment that wants events delivered needs `REDIS_ENABLED` and a worker process.
					EventOutboxMaintenanceModule,
					// The per-minute pass that re-attempts a delivery the ladder says is due. It is the
					// second half of the outbound surface: the fan-out above makes the first attempt, and
					// without this one there is never a second — `WebhookDeliveryService` writes seven rungs
					// onto every row and `findDue` reads exactly the rows that are due, and nothing called
					// it, so an endpoint unreachable for the one moment it was reached never heard about
					// that event again.
					WebhookMaintenanceModule
			  ]
			: []),
		//Token cleanup scheduler is disabled by default; enable when ready
		TokenModule.forRoot({ enableScheduler: false }),
		AccessTokenModule,
		RefreshTokenModule
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
		},
		// Retry safety. Registered once, for the whole application, and inert on every handler that
		// does not declare `@Idempotent(...)`: a route that has not adopted the convention reads no
		// header, hashes nothing and writes no row it did not write before. Registered after the
		// serialization interceptor so the response it records is the one the handler produced.
		{
			provide: APP_INTERCEPTOR,
			useClass: IdempotencyInterceptor
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
