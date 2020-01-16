import { AggregatedEmployeeStatisticFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class AggregatedEmployeeStatisticQuery implements IQuery {
	static readonly type = '[EmployeeStatistic] Aggregated Employee Statistic';

	constructor(public readonly input: AggregatedEmployeeStatisticFindInput) {}
}
