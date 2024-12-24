import { IQuery } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { Employee } from '../../../core/entities/internal';

export class FindPublicEmployeesByOrganizationQuery implements IQuery {

	constructor(
		public readonly options: FindOptionsWhere<Employee>,
		public readonly relations: string[]
	) {}
}