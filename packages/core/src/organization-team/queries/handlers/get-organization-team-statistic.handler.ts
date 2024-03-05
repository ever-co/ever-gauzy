import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler implements IQueryHandler<GetOrganizationTeamStatisticQuery> {
	constructor(private readonly _organizationTeamService: OrganizationTeamService) {}

	async execute(input: GetOrganizationTeamStatisticQuery): Promise<IOrganizationTeam> {
		return await this._organizationTeamService.getOrganizationTeamStatistic(input);
	}
}
