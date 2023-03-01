import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationTeam } from '@gauzy/contracts';
import { FindPublicTeamQuery } from '../find-public-team.query';
import { PublicTeamService } from './../../public-team.service';

@QueryHandler(FindPublicTeamQuery)
export class FindPublicTeamHandler implements IQueryHandler<FindPublicTeamQuery, IOrganizationTeam> {

    constructor(
        private readonly _publicTeamService: PublicTeamService
    ) { }

    async execute(query: FindPublicTeamQuery): Promise<IOrganizationTeam> {
        const { params, options } = query;
        return await this._publicTeamService.findOneByProfileLink(params, options);
    }
}
