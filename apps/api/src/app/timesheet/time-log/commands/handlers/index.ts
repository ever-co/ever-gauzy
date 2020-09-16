import { TimeLogCreateHandler } from './time-log-create.handler';
import { TimeLogUpdateHandler } from './time-log-update.handler';
import { TimeLogDeleteHandler } from './time-log-delete.handler';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';
import { GetConflictTimeLogHandler } from './get-conflict-time-log.handler';

export const TimeLogCommandHandlers = [
	TimeLogCreateHandler,
	TimeLogUpdateHandler,
	TimeLogDeleteHandler,
	GetConflictTimeLogHandler,
	DeleteTimeSpanHandler
];
