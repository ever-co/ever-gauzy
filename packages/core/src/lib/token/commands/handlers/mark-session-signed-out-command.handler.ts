import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { TokenReadRepositoryToken, TokenWriteRepositoryToken } from '../../shared';
import {
	findSessionSignOutMarker,
	SESSION_SIGN_OUT_MARKER_TYPE,
	sessionSignOutMarkerKey
} from '../../shared/session-sign-out-marker';
import { TokenHasher } from '../../shared/token-hasher';
import { MarkSessionSignedOutCommand } from '../mark-session-signed-out.command';

/**
 * Writes the marker of a signed-out session. Signing a session out twice keeps the first marker; two sign-outs racing
 * on one session meet the unique hash, and the one that loses finds the marker the other wrote.
 */
@CommandHandler(MarkSessionSignedOutCommand)
export class MarkSessionSignedOutHandler implements ICommandHandler<MarkSessionSignedOutCommand, void> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(command: MarkSessionSignedOutCommand): Promise<void> {
		const { userId, sessionId, expiresAt, reason } = command;
		const tokenHash = this.tokenHasher.hashToken(sessionSignOutMarkerKey(userId, sessionId));
		if (await findSessionSignOutMarker(this.tokenReadRepository, tokenHash)) {
			return;
		}
		try {
			await this.tokenWriteRepository.create({
				userId,
				tokenType: SESSION_SIGN_OUT_MARKER_TYPE,
				tokenHash,
				status: TokenStatus.REVOKED,
				expiresAt,
				revokedAt: new Date(),
				revokedReason: reason,
				metadata: { sessionId }
			});
		} catch (error) {
			if (await findSessionSignOutMarker(this.tokenReadRepository, tokenHash)) {
				return;
			}
			throw error;
		}
	}
}
