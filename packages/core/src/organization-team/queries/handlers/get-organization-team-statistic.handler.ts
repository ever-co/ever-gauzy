import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IOrganizationTeam } from '@gauzy/contracts';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler implements IQueryHandler<GetOrganizationTeamStatisticQuery> {

	constructor(
		private readonly _organizationTeamService: OrganizationTeamService
	) { }

	/**
	* Executes the given query to get organization team statistics.
	*
	* @param input - The query input containing parameters to fetch the team statistics.
	* @returns A promise resolving to an object representing the organization team statistics.
	* @throws SomeException - If an error occurs during execution.
	*/
	async execute(input: GetOrganizationTeamStatisticQuery): Promise<IOrganizationTeam> {
		try {
			return await this._organizationTeamService.getOrganizationTeamStatistic(input);
		} catch (error) {
			throw new BadRequestException(`Failed to execute organization team statistic query`);
		}
	}
}
