import { TimesheetRecalculateHandler } from './timesheet-recalculate.handler';
import { TimesheetFirstOrCreateHandler } from './timesheet-first-or-create.handler';

export const TimesheetCommandHandlers = [
	TimesheetRecalculateHandler,
	TimesheetFirstOrCreateHandler
];
