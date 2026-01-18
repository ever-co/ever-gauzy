import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative } from '@gauzy/contracts';
import { OrganizationStrategicInitiativeFindByProjectQuery } from '../organization-strategic-initiative.find-by-project.query';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@QueryHandler(OrganizationStrategicInitiativeFindByProjectQuery)
export class OrganizationStrategicInitiativeFindByProjectHandler
	implements IQueryHandler<OrganizationStrategicInitiativeFindByProjectQuery>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the find by project query for organization strategic initiatives.
	 *
	 * @param query - The query containing the project ID.
	 * @returns A list of organization strategic initiatives linked to the project.
	 */
	public async execute(
		query: OrganizationStrategicInitiativeFindByProjectQuery
	): Promise<IOrganizationStrategicInitiative[]> {
		const { projectId } = query;
		return await this._organizationStrategicInitiativeService.findByProject(projectId);
	}
}
