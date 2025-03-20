/**
 * Public API Surface of @gauzy/core
 */
export { bootstrap } from './lib/bootstrap';
export {
	createMigration,
	ConnectionEntityManager,
	generateMigration,
	prepareSQLQuery,
	revertLastDatabaseMigration,
	runDatabaseMigrations
} from './lib/database';
export * from './lib/logger';
export * from './lib/core';
export * from './lib/core/seeds';
export { LazyFileInterceptor } from './lib/core/interceptors';
export { FileStorage, FileStorageFactory, UploadedFileStorage } from './lib/core/file-storage';
export * from './lib/shared';
export * from './lib/event-bus';

export * from './lib/tenant';
export { RoleModule, RoleService } from './lib/role';
export { RolePermissionModule, RolePermissionService } from './lib/role-permission';
export { UserModule, UserService } from './lib/user';

export * from './lib/organization';
export {
	OrganizationVendorModule,
	OrganizationVendorService,
	OrganizationVendorFirstOrCreateCommand
} from './lib/organization-vendor';
export {
	OrganizationContactModule,
	OrganizationContactService,
	OrganizationContactCreateCommand
} from './lib/organization-contact';
export {
	OrganizationProjectModule,
	OrganizationProjectService,
	OrganizationProjectCreateCommand,
	OrganizationProjectUpdateCommand
} from './lib/organization-project';

export * from './lib/employee';
export { TaskModule, TaskService, TaskCreateCommand, TaskUpdateCommand, AutomationTaskSyncCommand } from './lib/tasks';

export { IntegrationModule, IntegrationService } from './lib/integration';
export {
	IntegrationTenantModule,
	IntegrationTenantService,
	IntegrationTenantGetCommand,
	IntegrationTenantUpdateOrCreateCommand
} from './lib/integration-tenant';
export {
	IntegrationMapModule,
	IntegrationMapService,
	IntegrationMapSyncActivityCommand,
	IntegrationMapSyncEntityCommand,
	IntegrationMapSyncOrganizationCommand,
	IntegrationMapSyncProjectCommand,
	IntegrationMapSyncScreenshotCommand,
	IntegrationMapSyncTaskCommand,
	IntegrationMapSyncTimeLogCommand,
	IntegrationMapSyncTimeSlotCommand,
	IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand
} from './lib/integration-map';
export {
	IntegrationSettingModule,
	IntegrationSettingService,
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand
} from './lib/integration-setting';
export {
	IntegrationEntitySettingModule,
	IntegrationEntitySettingService,
	DEFAULT_ENTITY_SETTINGS
} from './lib/integration-entity-setting';
export {
	IntegrationEntitySettingTiedModule,
	IntegrationEntitySettingTiedService,
	PROJECT_TIED_ENTITIES
} from './lib/integration-entity-setting-tied';

export {
	TimeSlotModule,
	TimeSlotService,
	TimeSlotCreateCommand,
	CreateTimeSlotMinutesCommand
} from './lib/time-tracking/time-slot';
export { TimeLogModule, TimeLogService, TimeLogCreateCommand } from './lib/time-tracking/time-log';
export { ScreenshotModule, ScreenshotService, ScreenshotCreateCommand } from './lib/time-tracking/screenshot';
export { TimerStartedEvent, TimerStoppedEvent, TimerStatusUpdatedEvent } from './lib/time-tracking/timer';
export { TimerService } from './lib/time-tracking/timer/timer.service';
export { GetTimerStatusQuery, StartTimerCommand, StopTimerCommand } from './lib/time-tracking/timer';

export { IncomeModule, IncomeService, IncomeCreateCommand } from './lib/income';
export { ExpenseModule, ExpenseService, ExpenseCreateCommand } from './lib/expense';
export {
	ExpenseCategoriesModule,
	ExpenseCategoriesService,
	ExpenseCategoryFirstOrCreateCommand
} from './lib/expense-categories';
export { TagModule, TagService, Taggable, AutomationLabelSyncCommand, RelationalTagDTO } from './lib/tags';
export { TagTypeModule, TagTypeService } from './lib/tag-type';
