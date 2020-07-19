import { IQuery } from '@nestjs/cqrs';
import { EmployeeStatisticsHistoryFindInput } from '@gauzy/models';

export class EmployeeStatisticsHistoryQuery implements IQuery {
	static readonly type = '[EmployeeStatistics] History';

	constructor(public readonly input: EmployeeStatisticsHistoryFindInput) {}
}
