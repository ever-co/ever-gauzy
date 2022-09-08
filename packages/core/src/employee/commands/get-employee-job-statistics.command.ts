import { ICommand } from '@nestjs/cqrs';
import { PaginationParams } from './../../core/crud';
import { Employee } from './../employee.entity';

export class GetEmployeeJobStatisticsCommand implements ICommand {
	static readonly type = '[EmployeeJobStatistics] Get';

	constructor(
		public readonly request: PaginationParams<Employee>
	) {}
}
