import { IQuery } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { OrganizationContact } from '../../../core/entities/internal';

export class FindPublicClientsByOrganizationQuery implements IQuery {

	constructor(
		public readonly options: FindOptionsWhere<OrganizationContact>,
	) {}
}