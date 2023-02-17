import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { FindPublicTeamQuery } from '../find-public-team.query';
import { PublicTeamService } from './../../public-team.service';

@QueryHandler(FindPublicTeamQuery)
export class FindPublicTeamHandler implements IQueryHandler<FindPublicTeamQuery, IOrganizationTeam> {

    constructor(
        private readonly publicTeamService: PublicTeamService
    ) { }

    async execute(query: FindPublicTeamQuery): Promise<IOrganizationTeam> {
        const { params, relations = [] } = query;
        return await this.publicTeamService.findOneByProfileLink(params, relations);
    }
}
