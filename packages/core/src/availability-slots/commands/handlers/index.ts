import { AvailabilitySlotsCreateHandler } from './availability-slots.create.handler';
import { AvailabilitySlotsBulkCreateHandler } from './availability-slots.bulk.create.handler';
import { GetConflictAvailabilitySlotsHandler } from './get-conflict-availability-slots.handler';

export const CommandHandlers = [
	AvailabilitySlotsCreateHandler,
	AvailabilitySlotsBulkCreateHandler,
	GetConflictAvailabilitySlotsHandler
];
