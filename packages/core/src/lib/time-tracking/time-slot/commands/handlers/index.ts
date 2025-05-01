import { CreateTimeSlotHandler } from './create-time-slot.handler';
import { UpdateTimeSlotHandler } from './update-time-slot.handler';
import { TimeSlotBulkCreateOrUpdateHandler } from './time-slot-bulk-create-or-update.handler';
import { TimeSlotBulkCreateHandler } from './time-slot-bulk-create.handler';
import { DeleteTimeSlotHandler } from './delete-time-slot.handler';
import { TimeSlotBulkDeleteHandler } from './time-slot-bulk-delete.handler';
import { TimeSlotMergeHandler } from './time-slot-merge.handler';
import { TimeSlotCreateHandler } from './time-slot-create.handler';
import { ScheduleTimeSlotEntriesHandler } from './schedule-time-slot-entries.handler';
import { UpdateTimeSlotMinutesHandler } from '../../time-slot-minute/commands/handlers/update-time-slot-minutes.handler';
import { CreateTimeSlotMinutesHandler } from '../../time-slot-minute/commands/handlers/create-time-slot-minutes.handler';

export const CommandHandlers = [
	CreateTimeSlotHandler,
	UpdateTimeSlotHandler,
	DeleteTimeSlotHandler,
	TimeSlotBulkCreateOrUpdateHandler,
	TimeSlotBulkCreateHandler,
	TimeSlotBulkDeleteHandler,
	TimeSlotMergeHandler,
	TimeSlotCreateHandler,
	ScheduleTimeSlotEntriesHandler,
	CreateTimeSlotMinutesHandler,
	UpdateTimeSlotMinutesHandler
];
