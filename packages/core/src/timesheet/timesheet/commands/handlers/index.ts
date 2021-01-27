import { TimesheetRecalculateHandler } from './timesheet-recalculate.handler';
import { TimesheetFirstOrCreateHandler } from './timesheet-first-or-create.handler';
import { TimesheetUpdateStatusHandler } from './timesheet-update-status.handler';
import { TimesheetSubmitHandler } from './timesheet-submit.handler';

export const TimesheetCommandHandlers = [
	TimesheetRecalculateHandler,
	TimesheetFirstOrCreateHandler,
	TimesheetUpdateStatusHandler,
	TimesheetSubmitHandler
];
