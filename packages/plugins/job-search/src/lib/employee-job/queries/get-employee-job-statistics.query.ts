import { Employee, PaginationParams } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';

export class GetEmployeeJobStatisticsQuery implements IQuery {
	static readonly type = 'GetEmployeeJobStatisticsQuery';

	constructor(public readonly options: PaginationParams<Employee>) {}
}
