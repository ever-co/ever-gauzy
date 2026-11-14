import { NotFoundException } from '@nestjs/common';
import { IToken } from '../interfaces';
import { ITokenReadRepository } from '../interfaces/token-repository.interface';

/**
 * The token store row that records a session signed out by its user (ever-co/ever-gauzy#11921).
 *
 * It is kept in the token store, which is where a session's tokens live, as a revoked row of its own type: its hash is
 * the hash of the user and session it names (never of a token, so no presented token can match it), it expires with the
 * longest token a session can hold, and nothing validates or rotates it. Every check of a session's token (an access
 * token's request, a refresh, a mint for an inherited session) asks for it by that hash: one indexed read.
 */
export const SESSION_SIGN_OUT_MARKER_TYPE = 'USER_SESSION_SIGNED_OUT';

/**
 * The string a session's marker hash is computed from.
 *
 * @param userId The user the session belongs to.
 * @param sessionId The session.
 */
export function sessionSignOutMarkerKey(userId: string, sessionId: string): string {
	return `${SESSION_SIGN_OUT_MARKER_TYPE}:${userId}:${sessionId}`;
}

/**
 * Reads the row stored under a marker hash.
 *
 * @param repository The token store.
 * @param tokenHash The marker hash.
 * @returns The row, or null when there is none: the store answers a hash it does not hold by throwing
 * `NotFoundException` (`CrudService.findOneByWhereOptions`).
 */
export async function findSessionSignOutMarker(
	repository: ITokenReadRepository,
	tokenHash: string
): Promise<IToken | null> {
	try {
		return await repository.findByHash(tokenHash);
	} catch (error) {
		if (error instanceof NotFoundException) {
			return null;
		}
		throw error;
	}
}
