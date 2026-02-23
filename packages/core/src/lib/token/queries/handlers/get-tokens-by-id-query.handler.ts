import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenReadRepository } from '../../interfaces/token-repository.interface';
import { IToken } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken } from '../../shared';
import { GetTokenByIdQuery } from '../get-token-by-id.query';

@QueryHandler(GetTokenByIdQuery)
export class GetTokenByIdHandler implements IQueryHandler<GetTokenByIdQuery, IToken> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenRepository: ITokenReadRepository
	) {}

	async execute(query: GetTokenByIdQuery): Promise<IToken> {
		const token = await this.tokenRepository.findById(query.tokenId);

		if (!token) {
			throw new NotFoundException('Token not found');
		}

		return token;
	}
}
