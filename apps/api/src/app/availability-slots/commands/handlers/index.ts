import { AvailabilitySlotsCreateHandler } from './availability-slots.create.handler';
import { AvailabilitySlotsBulkCreateHandler } from './availability-slots.bulk.create.handler';

export const CommandHandlers = [
	AvailabilitySlotsCreateHandler,
	AvailabilitySlotsBulkCreateHandler
];
