import { CreateTimeSlotHandler } from './create-time-slot.handler';
import { UpdateTimeSlotHandler } from './update-time-slot.handler';
import { CreateTimeSlotMinutesHandler } from './create-time-slot-minutes.handler';
import { UpdateTimeSlotMinutesHandler } from './update-time-slot-minutes.handler';
import { TimeSlotBulkCreateOrUpdateHandler } from './time-slot-bulk-create-or-update.handler';
import { TimeSlotBulkCreateHandler } from './time-slot-bulk-create.handler';
import { DeleteTimeSlotHandler } from './delete-time-slot.handler';
import { TimeSlotBulkDeleteHandler } from './time-slot-bulk-delete.handler';
import { TimeSlotMergeHandler } from './time-slot-merge.handler';
import { TimeSlotCreateHandler } from './time-slot-create.handler';
import { ScheduleTimeSlotEntriesHandler } from './schedule-time-slot-entries.handler';

export const CommandHandlers = [
	CreateTimeSlotHandler,
	UpdateTimeSlotHandler,
	DeleteTimeSlotHandler,
	TimeSlotBulkCreateOrUpdateHandler,
	TimeSlotBulkCreateHandler,
	CreateTimeSlotMinutesHandler,
	UpdateTimeSlotMinutesHandler,
	TimeSlotBulkDeleteHandler,
	TimeSlotMergeHandler,
	TimeSlotCreateHandler,
	ScheduleTimeSlotEntriesHandler
];
