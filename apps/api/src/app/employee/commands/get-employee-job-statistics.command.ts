import { ICommand } from '@nestjs/cqrs';
import { FindManyOptions } from 'typeorm';

export class GetEmployeeJobStatisticsCommand implements ICommand {
	static readonly type = '[EmployeeJobStatistics] Get';

	constructor(public readonly request: FindManyOptions) {}
}
