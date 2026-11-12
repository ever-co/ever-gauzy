import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

/** Time slots of one employee, by id. */
export interface ITimeSlotDurationRecalculateInput {
	organizationId: ID;
	employeeId: ID;
	tenantId?: ID;
	timeSlotsIds: ID[];
}

export class TimeSlotDurationRecalculateCommand implements ICommand {
	static readonly type = '[TimeSlot] recalculate duration';

	constructor(public readonly input: ITimeSlotDurationRecalculateInput) {}
}
