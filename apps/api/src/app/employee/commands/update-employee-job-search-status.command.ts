import { UpdateEmployeeJobsStatistics } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class UpdateEmployeeJobSearchStatusCommand implements ICommand {
	static readonly type = '[Employee] Get';

	constructor(
		public readonly employeeId: string,
		public readonly request: UpdateEmployeeJobsStatistics
	) {}
}
