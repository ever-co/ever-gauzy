import { IQuery } from '@nestjs/cqrs';
import { IEmployeeStatisticsHistoryFindInput } from '@gauzy/models';

export class EmployeeStatisticsHistoryQuery implements IQuery {
	static readonly type = '[EmployeeStatistics] History';

	constructor(public readonly input: IEmployeeStatisticsHistoryFindInput) {}
}
