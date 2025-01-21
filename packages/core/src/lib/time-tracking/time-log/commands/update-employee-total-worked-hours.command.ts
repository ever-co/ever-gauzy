import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class UpdateEmployeeTotalWorkedHoursCommand implements ICommand {
	static readonly type = '[Employee] Update Total Worked Hours';

	constructor(public readonly employeeId: ID, public readonly hours?: number) {}
}
