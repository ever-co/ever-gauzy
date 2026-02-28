import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenReadRepository } from '../../interfaces/token-repository.interface';
import { IToken } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken } from '../../shared';
import { GetTokenAuditTrailQuery } from '../get-token-audit-trail.query';

@QueryHandler(GetTokenAuditTrailQuery)
export class GetTokenAuditTrailHandler implements IQueryHandler<GetTokenAuditTrailQuery, IToken[]> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenRepository: ITokenReadRepository
	) {}

	async execute(query: GetTokenAuditTrailQuery): Promise<IToken[]> {
		const token = await this.tokenRepository.findById(query.tokenId);

		if (!token) {
			throw new NotFoundException('Token not found');
		}

		const trail: IToken[] = [token];
		const visited = new Set<string>();
		visited.add(token.id);

		// Follow the rotation chain backwards with cycle detection
		let currentToken = token;
		while (currentToken.rotatedFromTokenId) {
			if (visited.has(currentToken.rotatedFromTokenId)) {
				// Cycle detected, break
				break;
			}
			const previousToken = await this.tokenRepository.findById(currentToken.rotatedFromTokenId);
			if (previousToken) {
				trail.unshift(previousToken);
				visited.add(previousToken.id);
				currentToken = previousToken;
			} else {
				break;
			}
		}

		// Follow the rotation chain forwards with cycle detection
		currentToken = token;
		while (currentToken.rotatedToTokenId) {
			if (visited.has(currentToken.rotatedToTokenId)) {
				// Cycle detected, break
				break;
			}
			const nextToken = await this.tokenRepository.findById(currentToken.rotatedToTokenId);
			if (nextToken) {
				trail.push(nextToken);
				visited.add(nextToken.id);
				currentToken = nextToken;
			} else {
				break;
			}
		}

		return trail;
	}
}
