import { ICommand } from '@nestjs/cqrs';
import { IAvailabilitySlotsCreateInput } from '@gauzy/models';

export class AvailabilitySlotsBulkCreateCommand implements ICommand {
	static readonly type = '[AvailabilitySlots] Register';

	constructor(public readonly input: IAvailabilitySlotsCreateInput[]) {}
}
