import { ICommand } from '@nestjs/cqrs';

export class UpdateEmployeeTotalWorkedHoursCommand implements ICommand {
	static readonly type = '[Employee] Update Total Worked Hours';

	constructor(
		public readonly employeeId: string,
		public readonly hours?: number
	) {}
}
