import { IQuery } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { Organization } from '../../../core/entities/internal';

export class FindPublicOrganizationQuery implements IQuery {

	constructor(
		public readonly params: FindOptionsWhere<Organization>,
		public readonly relations: string[],
	) {}
}