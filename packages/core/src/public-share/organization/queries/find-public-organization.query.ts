import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { Organization } from '../../../core/entities/internal';

export class FindPublicOrganizationQuery implements IQuery {

	constructor(
		public readonly params: FindConditions<Organization>,
	) {}
}