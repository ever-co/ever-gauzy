import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { OrganizationContact } from '../../../core/entities/internal';

export class FindPublicClientsByOrganizationQuery implements IQuery {

	constructor(
		public readonly options: FindConditions<OrganizationContact>,
	) {}
}