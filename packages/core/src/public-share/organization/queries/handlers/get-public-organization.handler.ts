import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPublicOrganizationQuery } from './../get-public-organization.query';
import { PublicOrganizationService } from './../../public-organization.service';

@QueryHandler(GetPublicOrganizationQuery)
export class GetPublicOrganizationHandler implements IQueryHandler<GetPublicOrganizationQuery> {

    constructor(
        private readonly publicOrganizationService: PublicOrganizationService
    ) {}

    async execute(query: GetPublicOrganizationQuery) {
        const { where } = query;
        return await this.publicOrganizationService.getOneByProfileLink(where);
    }
}