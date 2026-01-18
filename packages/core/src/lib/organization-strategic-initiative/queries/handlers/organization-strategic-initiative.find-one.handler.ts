import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative } from '@gauzy/contracts';
import { OrganizationStrategicInitiativeFindOneQuery } from '../organization-strategic-initiative.find-one.query';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@QueryHandler(OrganizationStrategicInitiativeFindOneQuery)
export class OrganizationStrategicInitiativeFindOneHandler
	implements IQueryHandler<OrganizationStrategicInitiativeFindOneQuery>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the find one query for an organization strategic initiative.
	 *
	 * @param query - The query containing the ID and options.
	 * @returns The found organization strategic initiative.
	 */
	public async execute(
		query: OrganizationStrategicInitiativeFindOneQuery
	): Promise<IOrganizationStrategicInitiative> {
		const { id, options } = query;
		return await this._organizationStrategicInitiativeService.findOneById(id, options);
	}
}
