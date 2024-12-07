import { IOrganizationContact, IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindPublicClientsByOrganizationQuery } from './../find-public-clients-by-organization.query';
import { PublicOrganizationService } from './../../public-organization.service';

@QueryHandler(FindPublicClientsByOrganizationQuery)
export class FindPublicClientsByOrganizationHandler implements IQueryHandler<FindPublicClientsByOrganizationQuery> {

    constructor(
        private readonly publicOrganizationService: PublicOrganizationService
    ) {}

    async execute(query: FindPublicClientsByOrganizationQuery): Promise<IPagination<IOrganizationContact>> {
        const { options } = query;
        return await this.publicOrganizationService.findPublicClientsByOrganization(
            options
        );
    }
}