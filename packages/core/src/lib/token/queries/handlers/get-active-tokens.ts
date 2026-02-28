import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenReadRepository } from '../../interfaces/token-repository.interface';
import { IToken } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken } from '../../shared';
import { GetActiveTokensQuery } from '../get-active-tokens';

@QueryHandler(GetActiveTokensQuery)
export class GetActiveTokensHandler implements IQueryHandler<GetActiveTokensQuery, IToken[]> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenRepository: ITokenReadRepository
	) {}

	async execute(query: GetActiveTokensQuery): Promise<IToken[]> {
		const tokens = await this.tokenRepository.findActiveByUserAndType(query.userId, query.tokenType);

		return tokens;
	}
}
