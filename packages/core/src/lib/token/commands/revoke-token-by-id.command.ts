import { ICommand } from '@nestjs/cqrs';

/**
 * Revokes one stored token named by its id, when it belongs to `userId` and is of `tokenType`. With `reviseRevoked`, a
 * token already revoked for another reason is given this revocation's reason instead.
 */
export class RevokeTokenByIdCommand implements ICommand {
	constructor(
		public readonly dto: {
			tokenId: string;
			userId: string;
			tokenType: string;
			revokedById?: string;
			reason?: string;
			reviseRevoked?: boolean;
		}
	) {}
}
