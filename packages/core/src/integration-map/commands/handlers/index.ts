import { IntegrationMapSyncProjectHandler } from './integration-map.sync-project.handler';
import { IntegrationMapSyncEntityHandler } from './integration-map.sync-entity.handler';
import { IntegrationMapSyncOrganizationHandler } from './integration-map.sync-organization.handler';
import { IntegrationMapSyncTaskHandler } from './integration-map.sync-task.handler';
import { IntegrationMapSyncTimeSlotHandler } from './integration-map.sync-time-slot.handler';

export const CommandHandlers = [
	IntegrationMapSyncEntityHandler,
	IntegrationMapSyncOrganizationHandler,
	IntegrationMapSyncProjectHandler,
	IntegrationMapSyncTaskHandler,
	IntegrationMapSyncTimeSlotHandler
];
