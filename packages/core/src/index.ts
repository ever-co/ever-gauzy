/**
 * Public API Surface of @gauzy/core
 */
export { bootstrap, registerPluginConfig } from './lib/bootstrap';
export * from './lib/core';
export {
	ALLOWED_ARCHIVE_EXTENSIONS,
	ALLOWED_ARCHIVE_MIME_TYPES,
	ALLOWED_AUDIO_EXTENSIONS,
	ALLOWED_AUDIO_MIME_TYPES,
	ALLOWED_IMAGE_EXTENSIONS,
	ALLOWED_IMAGE_MIME_TYPES,
	ALLOWED_VIDEO_EXTENSIONS,
	ALLOWED_VIDEO_MIME_TYPES,
	BLOCKED_UPLOAD_EXTENSIONS,
	SCRIPT_CAPABLE_NON_DOCUMENT_EXTENSIONS,
	FileStorage,
	FileStorageFactory,
	MARKUP_SCAN_MAX_BYTES,
	UploadedFileStorage,
	archiveUploadFileFilter,
	assertNotMarkupContent,
	audioUploadFileFilter,
	createUploadFileFilter,
	documentUploadFileFilter,
	imageUploadFileFilter,
	isMarkupContent,
	shouldScanForMarkup,
	videoUploadFileFilter,
	RENDERABLE_KEY_EXTENSIONS,
	toSafeStorageExtension
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
// The probes a migration needs to add a `CHECK` safely: a rule about a populated table is added on its
// own tick, long after the file that created the table, and every package that adds one needs the same
// four probes — the table, the columns the rule reads, the constraint's own absence, and the embedded
// dialect, which cannot add a constraint to an existing table at all.
export {
	addCheckConstraint,
	dropCheckConstraint,
	hasCheckConstraint,
	supportsCheckConstraints
} from './lib/database/check-constraint.helper';
export type {
	ICheckConstraintDefinition,
	TCheckConstraintOutcome
} from './lib/database/check-constraint.helper';
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
// The approval machinery is public API for the same reason as `FeatureModule` above: a package that
// wants a decision recorded on a document it owns has to file the request against the platform's own
// `request_approval` row rather than declaring a parallel approval table, and it can only do that
// through the module that provides the service and the service itself.
export { RequestApprovalModule } from './lib/request-approval/request-approval.module';
export { RequestApprovalService } from './lib/request-approval/request-approval.service';
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

// Retry safety and optimistic concurrency are conventions a controller adopts with a decorator, and
// the controllers that adopt them live in this package and in plugins alike — a decorator that is
// not part of the public surface cannot be applied from a plugin at all.
export {
	IdempotencyInterceptor,
	IdempotencyModule,
	IdempotencyService,
	Idempotent,
	IDEMPOTENT_METADATA_KEY,
	IDEMPOTENCY_KEY_MEMBER
} from './lib/idempotency';
// The concurrency kernel's surface is the decorator a route adopts *and* the pieces a plugin has to
// name to implement one: the type of the expectation its write is predicated on, the increment that
// keeps every writer moving the counter by the same step, and the metadata key a spec reads to assert
// a route declared the convention. A plugin that has to derive or restate any of the three from the
// outside is a plugin that can drift from the kernel it is implementing.
export {
	Versioned,
	VersionGuard,
	VersionInterceptor,
	VersionedColumn,
	commitVersionedUpdate,
	parseIfMatch,
	formatEntityTag,
	versionExpectationOf,
	bumpVersion,
	IVersionExpectation,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY
} from './lib/concurrency';
/**
 * The API conventions a resource adopts: the query protocol, field-level visibility, bulk
 * application and the accepted-operation handle.
 *
 * Exported because a plugin package has to be able to implement the same conventions as a resource
 * built into core. Without this a plugin can expose a list endpoint but cannot declare what may be
 * filtered, sorted or selected on it, cannot withhold a field from a caller who may not read it, and
 * cannot accept a long-running request — so it would either invent its own or go without.
 */
export * from './lib/api';
/**
 * The kernel capabilities every domain builds on: exact money arithmetic, the generic rule engine,
 * the money-adjustment and tax ledgers, document numbering, the retry-safe request store, the
 * transactional outbox, the durable-operation runtime, outbound delivery, and platform search.
 *
 * Exported for the same reason as the API conventions above — a plugin package has to be able to
 * build on the same kernel a resource in core does. A domain that cannot reach the money layer
 * writes its own arithmetic, and a domain that cannot reach the rule engine writes its own
 * conditions; both are how a platform ends up with three of everything.
 */
export * from './lib/money';
export * from './lib/measurement';
export * from './lib/channel';
export * from './lib/channel-domain';
export * from './lib/channel-region';
export * from './lib/region';
export * from './lib/region-country';
export * from './lib/address';
export * from './lib/contact-group';
export * from './lib/contact-group-member';
export * from './lib/contact-credential';
export * from './lib/contact-buyer';
export * from './lib/payment-account-holder';
export * from './lib/payment-method-token';
export * from './lib/payment-instrument';
export * from './lib/rule';
export * from './lib/adjustment';
export * from './lib/tax-line';
export * from './lib/sequence';
export * from './lib/search';
export * from './lib/event-outbox';
export * from './lib/operation';
export * from './lib/webhook';
export * from './lib/job-execution';
export * from './lib/job-dead-letter';
