import { AutomationIssueSyncHandler } from './automation-issue.sync.handler';
import { AutomationLabelSyncHandler } from './automation-label.sync.handler';

export const AutomationCommandHandlers = [
    AutomationIssueSyncHandler,
    AutomationLabelSyncHandler
];
