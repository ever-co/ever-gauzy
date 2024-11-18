/**
 * Public API Surface of @gauzy/core
 */
export { bootstrap } from './bootstrap';
export {
	createMigration,
	ConnectionEntityManager,
	generateMigration,
	prepareSQLQuery,
	revertLastDatabaseMigration,
	runDatabaseMigrations
} from './database';
export * from './logger';
export * from './core';
export * from './core/seeds';
export * from './shared';
export * from './event-bus';

export * from './tenant';
export { RoleModule, RoleService } from './role';
export { RolePermissionModule, RolePermissionService } from './role-permission';
export { UserModule, UserService } from './user';

export * from './organization';
export {
	OrganizationVendorModule,
	OrganizationVendorService,
	OrganizationVendorFirstOrCreateCommand
} from './organization-vendor';
export {
	OrganizationContactModule,
	OrganizationContactService,
	OrganizationContactCreateCommand
} from './organization-contact';
export {
	OrganizationProjectModule,
	OrganizationProjectService,
	OrganizationProjectCreateCommand,
	OrganizationProjectUpdateCommand
} from './organization-project';

export * from './employee';
export { TaskModule, TaskService, TaskCreateCommand, TaskUpdateCommand, AutomationTaskSyncCommand } from './tasks';

export { IntegrationModule, IntegrationService } from './integration';
export {
	IntegrationTenantModule,
	IntegrationTenantService,
	IntegrationTenantGetCommand,
	IntegrationTenantUpdateOrCreateCommand
} from './integration-tenant';
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
} from './integration-map';
export {
	IntegrationSettingModule,
	IntegrationSettingService,
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand
} from './integration-setting';
export {
	IntegrationEntitySettingModule,
	IntegrationEntitySettingService,
	DEFAULT_ENTITY_SETTINGS
} from './integration-entity-setting';
export {
	IntegrationEntitySettingTiedModule,
	IntegrationEntitySettingTiedService,
	PROJECT_TIED_ENTITIES
} from './integration-entity-setting-tied';

export {
	TimeSlotModule,
	TimeSlotService,
	TimeSlotCreateCommand,
	CreateTimeSlotMinutesCommand
} from './time-tracking/time-slot';
export { TimeLogModule, TimeLogService, TimeLogCreateCommand } from './time-tracking/time-log';
export { ScreenshotModule, ScreenshotService, ScreenshotCreateCommand } from './time-tracking/screenshot';

export { IncomeModule, IncomeService, IncomeCreateCommand } from './income';
export { ExpenseModule, ExpenseService, ExpenseCreateCommand } from './expense';
export {
	ExpenseCategoriesModule,
	ExpenseCategoriesService,
	ExpenseCategoryFirstOrCreateCommand
} from './expense-categories';
export { TagModule, TagService, Taggable, AutomationLabelSyncCommand, RelationalTagDTO } from './tags';
