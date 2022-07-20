import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { Employee } from '../../../core/entities/internal';

export class FindOnePublicEmployeeQuery implements IQuery {

	constructor(
		public readonly params: FindConditions<Employee>,
		public readonly relations: string[]
	) {}
}