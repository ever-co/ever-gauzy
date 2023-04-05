import { IEmployee, UpdateEmployeeJobsStatistics } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class UpdateEmployeeJobSearchStatusCommand implements ICommand {
	static readonly type = '[Employee] Update Job Search Status';

	constructor(
		public readonly employeeId: IEmployee['id'],
		public readonly input: UpdateEmployeeJobsStatistics
	) { }
}
