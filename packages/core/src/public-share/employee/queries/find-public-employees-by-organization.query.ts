import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { Employee } from '../../../core/entities/internal';

export class FindPublicEmployeesByOrganizationQuery implements IQuery {

	constructor(
		public readonly options: FindConditions<Employee>,
		public readonly relations: string[]
	) {}
}