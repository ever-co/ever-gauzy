import { ActivityCreateHandler } from './activity-create.handler';
import { ActivityUpdateHandler } from './activity-update.handler';
import { BulkActivitiesSaveHandler } from './bulk-activities-save.handler';

export const CommandHandlers = [
    ActivityCreateHandler,
    ActivityUpdateHandler,
    BulkActivitiesSaveHandler
];
