import { ActivityCreateHandler } from './activity-create.handler';
import { BulkActivitiesSaveHandler } from './bulk-activities-save.handler';

export const CommandHandlers = [
    ActivityCreateHandler,
    BulkActivitiesSaveHandler
];
