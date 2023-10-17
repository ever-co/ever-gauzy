import { AutomationSyncIssueHandler } from './automation-issue.create.handler';
import { AutomationSyncLabelHandler } from './automation-label.create.handler';

export const AutomationCommandHandlers = [
    AutomationSyncIssueHandler,
    AutomationSyncLabelHandler
];
