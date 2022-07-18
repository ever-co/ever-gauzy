import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { Organization } from './../../../core/entities/internal';

export class GetPublicOrganizationQuery implements IQuery {

	constructor(
		public readonly where: FindConditions<Organization>,
	) {}
}