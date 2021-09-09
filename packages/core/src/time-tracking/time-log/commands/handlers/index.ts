import { TimeLogCreateHandler } from './time-log-create.handler';
import { TimeLogUpdateHandler } from './time-log-update.handler';
import { TimeLogDeleteHandler } from './time-log-delete.handler';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';
import { GetConflictTimeLogHandler } from './get-conflict-time-log.handler';
import { GetTimeLogGroupByDateHandler } from './get-time-log-group-by-date.handler';
import { GetTimeLogGroupByEmployeeHandler } from './get-time-log-group-by-employee.handler';
import { GetTimeLogGroupByProjectHandler } from './get-time-log-group-by-project.handler';
import { GetTimeLogGroupByClientHandler } from './get-time-log-group-by-client.handler';

export const CommandHandlers = [
	TimeLogCreateHandler,
	TimeLogUpdateHandler,
	TimeLogDeleteHandler,
	GetConflictTimeLogHandler,
	DeleteTimeSpanHandler,
	GetTimeLogGroupByDateHandler,
	GetTimeLogGroupByProjectHandler,
	GetTimeLogGroupByEmployeeHandler,
	GetTimeLogGroupByClientHandler
];
