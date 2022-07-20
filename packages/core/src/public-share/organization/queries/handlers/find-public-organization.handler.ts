import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganization } from '@gauzy/contracts';
import { FindPublicOrganizationQuery } from './../find-public-organization.query';
import { PublicOrganizationService } from './../../public-organization.service';

@QueryHandler(FindPublicOrganizationQuery)
export class FindPublicOrganizationHandler implements IQueryHandler<FindPublicOrganizationQuery> {

    constructor(
        private readonly publicOrganizationService: PublicOrganizationService
    ) {}

    async execute(query: FindPublicOrganizationQuery): Promise<IOrganization> {
        const { params, relations = [] } = query;
        return await this.publicOrganizationService.findOneByProfileLink(params, relations);
    }
}