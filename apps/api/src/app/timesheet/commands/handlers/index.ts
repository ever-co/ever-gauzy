import { TimeLogCreateHandler } from './time-log-create.handler';
import { TimeSlotCreateHandler } from './time-slot-create.handler';
import { TimesheetCreateHandler } from './timesheet-create.handler';
import { TimesheetGetHandler } from './timesheet-get.handler';

export const CommandHandlers = [
	TimeLogCreateHandler,
	TimeSlotCreateHandler,
	TimesheetCreateHandler,
	TimesheetGetHandler
];
