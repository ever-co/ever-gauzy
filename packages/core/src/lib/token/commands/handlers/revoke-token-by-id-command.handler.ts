import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { TokenReadRepositoryToken, TokenWriteRepositoryToken } from '../../shared';
import { tokenWithRules } from '../../shared/token-rules';
import { RevokeTokenByIdCommand } from '../revoke-token-by-id.command';

/**
 * Revokes a stored token named by its id, for a caller who holds the id and not the token itself (a user signing out
 * one of their sessions).
 *
 * A token of another user or of another type is left alone, so an id can never reach beyond what the caller owns; a
 * token that is no longer active is left as it is.
 *
 * @returns Whether this call revoked the token.
 */
@CommandHandler(RevokeTokenByIdCommand)
export class RevokeTokenByIdHandler implements ICommandHandler<RevokeTokenByIdCommand, boolean> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository
	) {}

	async execute(command: RevokeTokenByIdCommand): Promise<boolean> {
		const { tokenId, userId, tokenType, revokedById, reason } = command.dto;

		const stored = await this.tokenReadRepository.findById(tokenId);
		if (!stored) {
			return false;
		}

		const isOwnToken = stored.userId === userId;
		const isOfType = stored.tokenType === tokenType;
		if (!isOwnToken || !isOfType) {
			return false;
		}

		// The rule is the record's own method; a MikroORM read answers the row without it, see `tokenWithRules`.
		const token = tokenWithRules(stored);
		if (!token.canRevoke()) {
			return false;
		}

		return this.tokenWriteRepository.updateStatus(token.id, TokenStatus.REVOKED, token.version, {
			revokedById,
			revokedReason: reason
		});
	}
}
