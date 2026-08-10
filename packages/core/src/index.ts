/**
 * Public API Surface of @gauzy/core
 */
export { bootstrap, registerPluginConfig } from './lib/bootstrap';
export * from './lib/core';
export {
	ALLOWED_AUDIO_MIME_TYPES,
	ALLOWED_IMAGE_MIME_TYPES,
	ALLOWED_VIDEO_MIME_TYPES,
	BLOCKED_UPLOAD_EXTENSIONS,
	FileStorage,
	FileStorageFactory,
	UploadedFileStorage,
	assertNotMarkupContent,
	audioUploadFileFilter,
	createUploadFileFilter,
	imageUploadFileFilter,
	isMarkupContent,
	videoUploadFileFilter
} from './lib/core/file-storage';
export { LazyFileInterceptor } from './lib/core/interceptors';
export * from './lib/core/seeds';
export {
	ConnectionEntityManager,
	createMigration,
	generateMigration,
	prepareSQLQuery,
	revertLastDatabaseMigration,
	runDatabaseMigrations
} from './lib/database';
export * from './lib/event-bus';
export * from './lib/logger';
export { EVER_REDIS_CLIENT, RedisModule } from './lib/redis';
export * from './lib/shared';

export { PasswordHashModule, PasswordHashService } from './lib/password-hash';
// `ActivityLogModule` and `MentionModule` are `@Global()`, so a plugin can inject these services
// without importing either module — but it still needs the classes as DI tokens/types. Exporting
// them is what lets a plugin write its own activity-log timeline and @mention fan-out through the
// platform mechanisms instead of re-implementing them.
export { ActivityLogService } from './lib/activity-log/activity-log.service';
export { MentionService } from './lib/mention/mention.service';
// 🛑 `@Global()` means "available everywhere ONCE IMPORTED", not "always present". The API gets
// both modules through core's own `AppModule`; a host that builds its own module graph —
// `apps/worker`, which runs the plugin pipelines without core's HTTP `AppModule` — has to import
// them itself or it fails DI at boot on the first plugin that injects either service.
export { ActivityLogModule } from './lib/activity-log/activity-log.module';
export { MentionModule } from './lib/mention/mention.module';
// Same rationale as `MentionService` above, for the entity-subscription fan-out: the handler is
// registered by core, but a plugin that wants an author subscribed to the entity they just created
// (the pattern `CommentService` uses) needs the event CLASS to publish — `@nestjs/cqrs` dispatches
// on the constructor, so a structurally identical local copy would never reach the handler.
export { CreateEntitySubscriptionEvent } from './lib/entity-subscription/events/entity-subscription.create.event';
// `FeatureFlagGuard` is public API (exported from `./lib/shared`), so the module that provides
// its `FeatureService` dependency has to be public too — otherwise any plugin whose controllers
// carry `@UseGuards(..., FeatureFlagGuard)` cannot satisfy it and the whole API fails to
// bootstrap with an `UnknownDependenciesException`.
export { FeatureModule } from './lib/feature/feature.module';
export { FeatureService } from './lib/feature/feature.service';
export { FeatureOrganizationService } from './lib/feature/feature-organization.service';
export { RoleModule, RoleService } from './lib/role';
export { RolePermissionModule, RolePermissionService } from './lib/role-permission';
export * from './lib/tenant';
export { UserModule, UserService } from './lib/user';

export * from './lib/organization';
export {
	OrganizationContactCreateCommand,
	OrganizationContactModule,
	OrganizationContactService
} from './lib/organization-contact';
export {
	OrganizationProjectCreateCommand,
	OrganizationProjectModule,
	OrganizationProjectService,
	OrganizationProjectUpdateCommand
} from './lib/organization-project';
export {
	OrganizationVendorFirstOrCreateCommand,
	OrganizationVendorModule,
	OrganizationVendorService
} from './lib/organization-vendor';

export * from './lib/employee';
export { AutomationTaskSyncCommand, TaskCreateCommand, TaskModule, TaskService, TaskUpdateCommand } from './lib/tasks';

export { IntegrationModule, IntegrationService } from './lib/integration';
export {
	DEFAULT_ENTITY_SETTINGS,
	IntegrationEntitySettingModule,
	IntegrationEntitySettingService
} from './lib/integration-entity-setting';
export {
	IntegrationEntitySettingTiedModule,
	IntegrationEntitySettingTiedService,
	PROJECT_TIED_ENTITIES
} from './lib/integration-entity-setting-tied';
export {
	IntegrationMapModule,
	IntegrationMapService,
	IntegrationMapSyncActivityCommand,
	IntegrationMapSyncEntityCommand,
	IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand,
	IntegrationMapSyncOrganizationCommand,
	IntegrationMapSyncProjectCommand,
	IntegrationMapSyncScreenshotCommand,
	IntegrationMapSyncTaskCommand,
	IntegrationMapSyncTimeLogCommand,
	IntegrationMapSyncTimeSlotCommand
} from './lib/integration-map';
export {
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingModule,
	IntegrationSettingService
} from './lib/integration-setting';
export {
	IntegrationTenantGetCommand,
	IntegrationTenantModule,
	IntegrationTenantService,
	IntegrationTenantUpdateOrCreateCommand
} from './lib/integration-tenant';

export { TenantApiKeyModule, TenantApiKeyService } from './lib/tenant-api-key';

export { CustomTrackingModule, CustomTrackingService } from './lib/time-tracking/custom-tracking';
export { ScreenshotCreateCommand, ScreenshotModule, ScreenshotService } from './lib/time-tracking/screenshot';
export { TimeLogCreateCommand, TimeLogModule, TimeLogService } from './lib/time-tracking/time-log';
export {
	CreateTimeSlotMinutesCommand,
	TimeSlotCreateCommand,
	TimeSlotModule,
	TimeSlotService
} from './lib/time-tracking/time-slot';
export {
	GetTimerStatusQuery,
	StartTimerCommand,
	StopTimerCommand,
	TimerStartedEvent,
	TimerStatusUpdatedEvent,
	TimerStoppedEvent
} from './lib/time-tracking/timer';
export { CommandHandlers } from './lib/time-tracking/timer/commands/handlers';
export { QueryHandlers } from './lib/time-tracking/timer/queries/handlers';
export { TimerModule } from './lib/time-tracking/timer/timer.module';
export { TimerService } from './lib/time-tracking/timer/timer.service';

export * from './lib/database/database.module';
// Export-archive opt-out for plugin entities holding DERIVED data (extracted text, embeddings,
// caches). Public API because the entities that need it live in plugins — without it every plugin
// entity is registered for export automatically, which is right for authored records and wrong for
// tables the platform rebuilds after an import.
export { isExportSkipped, SKIP_EXPORT_METADATA, SkipExport, skipExport } from './lib/export-import/skip-export.decorator';
export { ExpenseCreateCommand, ExpenseModule, ExpenseService } from './lib/expense';
export {
	ExpenseCategoriesModule,
	ExpenseCategoriesService,
	ExpenseCategoryFirstOrCreateCommand
} from './lib/expense-categories';
export { IncomeCreateCommand, IncomeModule, IncomeService } from './lib/income';
export { TagTypeModule, TagTypeService } from './lib/tag-type';
export { AutomationLabelSyncCommand, RelationalTagDTO, Taggable, TagModule, TagService } from './lib/tags';
export * from './lib/token';
