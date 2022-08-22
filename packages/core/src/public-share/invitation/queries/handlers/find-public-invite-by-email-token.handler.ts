import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PublicInviteService } from 'public-share/invitation/public-invite.service';
import { FindPublicInviteByEmailTokenQuery } from '../find-public-invite-by-email-token.query';

@QueryHandler(FindPublicInviteByEmailTokenQuery)
export class FindPublicInviteByEmailTokenHandler
    implements IQueryHandler<FindPublicInviteByEmailTokenQuery> {

    constructor(
        private readonly publicInviteService: PublicInviteService
    ) {}

    async execute(query: FindPublicInviteByEmailTokenQuery) {
        const { params, relations = [] } = query;
        try {
            return await this.publicInviteService.validate(params, relations);
        } catch (error) {
            throw new BadRequestException();
        }
    }
}