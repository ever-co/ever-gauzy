/**
 * Public API Surface of @gauzy/core
 */
export { bootstrap, registerPluginConfig } from './lib/bootstrap';
export * from './lib/core';
export { FileStorage, FileStorageFactory, UploadedFileStorage } from './lib/core/file-storage';
export { LazyFileInterceptor } from './lib/core/interceptors';
export * from './lib/core/seeds';
export {
	ConnectionEntityManager, createMigration, generateMigration,
	prepareSQLQuery,
	revertLastDatabaseMigration,
	runDatabaseMigrations
} from './lib/database';
export * from './lib/event-bus';
export * from './lib/logger';
export { EVER_REDIS_CLIENT, RedisModule } from './lib/redis';
export * from './lib/shared';

export { PasswordHashModule, PasswordHashService } from './lib/password-hash';
export { RoleModule, RoleService } from './lib/role';
export { RolePermissionModule, RolePermissionService } from './lib/role-permission';
export * from './lib/tenant';
export { UserModule, UserService } from './lib/user';

export * from './lib/organization';
export {
	OrganizationContactCreateCommand, OrganizationContactModule,
	OrganizationContactService
} from './lib/organization-contact';
export {
	OrganizationProjectCreateCommand, OrganizationProjectModule,
	OrganizationProjectService, OrganizationProjectUpdateCommand
} from './lib/organization-project';
export {
	OrganizationVendorFirstOrCreateCommand, OrganizationVendorModule,
	OrganizationVendorService
} from './lib/organization-vendor';

export * from './lib/employee';
export { AutomationTaskSyncCommand, TaskCreateCommand, TaskModule, TaskService, TaskUpdateCommand } from './lib/tasks';

export { IntegrationModule, IntegrationService } from './lib/integration';
export {
	DEFAULT_ENTITY_SETTINGS, IntegrationEntitySettingModule,
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
	IntegrationMapSyncEntityCommand, IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand, IntegrationMapSyncOrganizationCommand,
	IntegrationMapSyncProjectCommand,
	IntegrationMapSyncScreenshotCommand,
	IntegrationMapSyncTaskCommand,
	IntegrationMapSyncTimeLogCommand,
	IntegrationMapSyncTimeSlotCommand
} from './lib/integration-map';
export {
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand, IntegrationSettingModule,
	IntegrationSettingService
} from './lib/integration-setting';
export {
	IntegrationTenantGetCommand, IntegrationTenantModule,
	IntegrationTenantService, IntegrationTenantUpdateOrCreateCommand
} from './lib/integration-tenant';

export { CustomTrackingModule, CustomTrackingService } from './lib/time-tracking/custom-tracking';
export { ScreenshotCreateCommand, ScreenshotModule, ScreenshotService } from './lib/time-tracking/screenshot';
export { TimeLogCreateCommand, TimeLogModule, TimeLogService } from './lib/time-tracking/time-log';
export {
	CreateTimeSlotMinutesCommand, TimeSlotCreateCommand, TimeSlotModule,
	TimeSlotService
} from './lib/time-tracking/time-slot';
export { GetTimerStatusQuery, StartTimerCommand, StopTimerCommand, TimerStartedEvent, TimerStatusUpdatedEvent, TimerStoppedEvent } from './lib/time-tracking/timer';
export { CommandHandlers } from './lib/time-tracking/timer/commands/handlers';
export { QueryHandlers } from './lib/time-tracking/timer/queries/handlers';
export { TimerModule } from './lib/time-tracking/timer/timer.module';
export { TimerService } from './lib/time-tracking/timer/timer.service';

export * from './lib/database/database.module';
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
