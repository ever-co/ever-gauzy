import { Employee, BaseQueryDTO } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';

export class GetEmployeeJobStatisticsQuery implements IQuery {
	static readonly type = 'GetEmployeeJobStatisticsQuery';

	constructor(public readonly options: BaseQueryDTO<Employee>) {}
}
