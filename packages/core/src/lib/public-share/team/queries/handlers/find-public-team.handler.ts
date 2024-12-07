import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { FindPublicTeamQuery } from '../find-public-team.query';
import { PublicTeamService } from './../../public-team.service';

@QueryHandler(FindPublicTeamQuery)
export class FindPublicTeamHandler implements IQueryHandler<FindPublicTeamQuery, IOrganizationTeam> {

    constructor(
        private readonly _publicTeamService: PublicTeamService
    ) { }

	/**
     * Executes a query to find a public team by a given profile link.
     * @param query - An object containing the parameters and optional query options.
     * @returns A promise that resolves to an `IOrganizationTeam`.
     */
    async execute(query: FindPublicTeamQuery): Promise<IOrganizationTeam> {
        const { params, options } = query; // Extract parameters and options from the query
        return await this._publicTeamService.findOneByProfileLink(params, options); // Find the team by the profile link
    }
}
