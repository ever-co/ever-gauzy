import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InviteService } from './../../invite.service';
import { FindInviteByEmailCodeQuery } from '../find-invite-by-email-code.query';

@QueryHandler(FindInviteByEmailCodeQuery)
export class FindInviteByEmailCodeHandler implements IQueryHandler<FindInviteByEmailCodeQuery> {
	constructor(private readonly inviteService: InviteService) {}

	async execute(query: FindInviteByEmailCodeQuery) {
		const { params } = query;
		try {
			return await this.inviteService.validateByCode(params);
		} catch (error) {
			console.error(error, params);
			throw new BadRequestException();
		}
	}
}
