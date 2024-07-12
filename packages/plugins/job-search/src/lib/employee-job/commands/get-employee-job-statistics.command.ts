import { Employee, PaginationParams } from '@gauzy/core';
import { ICommand } from '@nestjs/cqrs';

export class GetEmployeeJobStatisticsCommand implements ICommand {
	static readonly type = '[EmployeeJobStatistics] Get';

	constructor(public readonly options: PaginationParams<Employee>) {}
}
