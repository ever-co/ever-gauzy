import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InviteService } from '../../invite.service';
import { FindInviteByEmailTokenQuery } from '../find-invite-by-email-token.query';

@QueryHandler(FindInviteByEmailTokenQuery)
export class FindInviteByEmailTokenHandler
    implements IQueryHandler<FindInviteByEmailTokenQuery> {

    constructor(
        private readonly inviteService: InviteService
    ) {}

    async execute(query: FindInviteByEmailTokenQuery) {
        const { params } = query;
        try {
            return await this.inviteService.validateByToken(params);
        } catch (error) {
            throw new BadRequestException();
        }
    }
}