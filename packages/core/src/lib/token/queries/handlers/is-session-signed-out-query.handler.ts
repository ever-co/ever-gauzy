import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenReadRepository } from '../../interfaces/token-repository.interface';
import { TokenReadRepositoryToken } from '../../shared';
import { findSessionSignOutMarker, sessionSignOutMarkerKey } from '../../shared/session-sign-out-marker';
import { TokenHasher } from '../../shared/token-hasher';
import { IsSessionSignedOutQuery } from '../is-session-signed-out.query';

/** Looks a session's sign-out marker up by its hash: one read on the token store's unique hash index. */
@QueryHandler(IsSessionSignedOutQuery)
export class IsSessionSignedOutHandler implements IQueryHandler<IsSessionSignedOutQuery, boolean> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(query: IsSessionSignedOutQuery): Promise<boolean> {
		const tokenHash = this.tokenHasher.hashToken(sessionSignOutMarkerKey(query.userId, query.sessionId));
		const marker = await findSessionSignOutMarker(this.tokenReadRepository, tokenHash);
		return !!marker;
	}
}
