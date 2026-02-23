import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenReadRepository } from '../../interfaces/token-repository.interface';
import { ITokenQueryResult } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken } from '../../shared';
import { GetTokensQuery } from '../get-tokens.query';

@QueryHandler(GetTokensQuery)
export class GetTokensHandler implements IQueryHandler<GetTokensQuery, ITokenQueryResult> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenRepository: ITokenReadRepository
	) {}

	async execute(query: GetTokensQuery): Promise<ITokenQueryResult> {
		return this.tokenRepository.query(query.filters, query.limit, query.offset);
	}
}
