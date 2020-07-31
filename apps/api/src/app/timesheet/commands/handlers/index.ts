import { TimeSlotCreateHandler } from './time-slot-create.handler';
import { TimesheetCreateHandler } from './timesheet-create.handler';
import { TimesheetGetHandler } from './timesheet-get.handler';
import { ScreenshotCreateHandler } from './screenshot-create.handler';
import { ActivityCreateHandler } from './activity-create.handler';
import { TimeSlotMinuteCreateHandler } from './time-slot-minute-create.handler';

export const CommandHandlers = [
	TimeSlotCreateHandler,
	TimeSlotMinuteCreateHandler,
	TimesheetCreateHandler,
	TimesheetGetHandler,
	ScreenshotCreateHandler,
	ActivityCreateHandler
];
