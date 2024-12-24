import { IntegrationMapSyncActivityHandler } from './integration-map.sync-activity.handler';
import { IntegrationMapSyncEntityHandler } from './integration-map.sync-entity.handler';
import { IntegrationMapSyncIssueHandler } from './integration-map.sync-issue.handler';
import { IntegrationMapSyncLabelHandler } from './integration-map.sync-label.handler';
import { IntegrationMapSyncOrganizationHandler } from './integration-map.sync-organization.handler';
import { IntegrationMapSyncProjectHandler } from './integration-map.sync-project.handler';
import { IntegrationMapSyncScreenshotHandler } from './integration-map.sync-screenshot.handler';
import { IntegrationMapSyncTaskHandler } from './integration-map.sync-task.handler';
import { IntegrationMapSyncTimeLogHandler } from './integration-map.sync-time-log.handler';
import { IntegrationMapSyncTimeSlotHandler } from './integration-map.sync-time-slot.handler';

export const CommandHandlers = [
	IntegrationMapSyncActivityHandler,
	IntegrationMapSyncEntityHandler,
	IntegrationMapSyncIssueHandler,
	IntegrationMapSyncLabelHandler,
	IntegrationMapSyncOrganizationHandler,
	IntegrationMapSyncProjectHandler,
	IntegrationMapSyncScreenshotHandler,
	IntegrationMapSyncTaskHandler,
	IntegrationMapSyncTimeLogHandler,
	IntegrationMapSyncTimeSlotHandler,
];
