import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative, IPagination } from '@gauzy/contracts';
import { OrganizationStrategicInitiativeFindAllQuery } from '../organization-strategic-initiative.find-all.query';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@QueryHandler(OrganizationStrategicInitiativeFindAllQuery)
export class OrganizationStrategicInitiativeFindAllHandler
	implements IQueryHandler<OrganizationStrategicInitiativeFindAllQuery>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the find all query for organization strategic initiatives.
	 *
	 * @param query - The query containing filter options.
	 * @returns A paginated list of organization strategic initiatives.
	 */
	public async execute(
		query: OrganizationStrategicInitiativeFindAllQuery
	): Promise<IPagination<IOrganizationStrategicInitiative>> {
		const { options } = query;
		return await this._organizationStrategicInitiativeService.findAll(options);
	}
}
