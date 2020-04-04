import { MonthAggregatedEmployeeStatisticsFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class MonthAggregatedEmployeeStatisticsQuery implements IQuery {
	static readonly type =
		'[MonthAggregatedEmployeeStatistics] Employee Statistics';

	constructor(
		public readonly input: MonthAggregatedEmployeeStatisticsFindInput
	) {}
}
