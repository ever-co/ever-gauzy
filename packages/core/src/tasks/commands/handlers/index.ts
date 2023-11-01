import { AutomationTaskSyncHandler } from './automation-task.sync.handler';
import { TaskCreateHandler } from './task-create.handler';
import { TaskUpdateHandler } from './task-update.handler';

export const CommandHandlers = [
    AutomationTaskSyncHandler,
    TaskCreateHandler,
    TaskUpdateHandler
];
