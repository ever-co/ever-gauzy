import { NotFoundException } from '@nestjs/common';
import { IToken, ITokenConfig, TokenStatus } from '../interfaces';
import { tokenWithRules } from './token-rules';

/** How many rotations are followed from a token to find the one its line ends with, before the search gives up. */
const MAX_ROTATIONS_FOLLOWED = 20;

/** Reads a stored token by its id. */
type ReadToken = (id: string) => Promise<IToken | null>;

/**
 * The id of the token a rotated one was replaced with.
 *
 * A row read through `TokenRepository`, and a TypeORM entity, state it in `rotatedToTokenId`. A MikroORM entity,
 * which is what a rotation reads inside its transaction, leaves that mirror empty and states the token on the
 * relation itself.
 */
function successorIdOf(token: IToken): string | null {
	return token.rotatedToTokenId ?? token.rotatedToToken?.id ?? null;
}

/** The id of the token that follows `token` in its line of rotations, or null for the token the line ends with. */
function nextIdOf(token: IToken): string | null {
	return token.status === TokenStatus.ROTATED ? successorIdOf(token) : null;
}

/** Reads a token the store may not hold: `TokenRepository` answers that by throwing `NotFoundException`. */
async function readIfStored(read: ReadToken, id: string): Promise<IToken | null> {
	try {
		return await read(id);
	} catch (error) {
		if (error instanceof NotFoundException) {
			return null;
		}
		throw error;
	}
}

/**
 * Follows a line of rotations from `first`, the token that replaced `origin`, to the token the line ends with.
 *
 * @param origin The token the line is followed for: every token of the line belongs to its user and is of its type.
 * @param first The token that replaced it.
 * @param findById Reads a stored token.
 * @param lockAndRead Given by a caller about to write the token it finds: reads a token again once no other
 *   transaction can change it. A line that another request moved on between the read and the lock is followed
 *   further, so that two requests never rotate the same token. The tokens after it are read under the lock too: a
 *   plain read in a transaction that reads a snapshot (MySQL's `REPEATABLE READ`) may not see the successor the
 *   other request has just committed, while a read under the lock does.
 * @returns The token the line ends with, or null when the line cannot be followed to its end: one of its tokens is
 *   missing or belongs elsewhere, or the end is more than `MAX_ROTATIONS_FOLLOWED` rotations away.
 */
async function followRotations(
	origin: IToken,
	first: IToken,
	findById: ReadToken,
	lockAndRead?: ReadToken
): Promise<IToken | null> {
	let token: IToken | null = first;
	// Set once a token of the line was read under the lock: each token after it is read under the lock as well
	let readUnderLock: ReadToken | null = null;
	for (let followed = 1; followed <= MAX_ROTATIONS_FOLLOWED; followed += 1) {
		const isOfTheSameLine = token.userId === origin.userId && token.tokenType === origin.tokenType;
		if (!isOfTheSameLine) {
			return null;
		}
		let nextId = nextIdOf(token);
		if (!nextId && lockAndRead && !readUnderLock) {
			// The end of the line as it was read. It is the end once no one else can rotate it
			token = await readIfStored(lockAndRead, token.id);
			if (!token) {
				return null;
			}
			readUnderLock = lockAndRead;
			nextId = nextIdOf(token);
		}
		if (!nextId) {
			return tokenWithRules(token);
		}
		// The token after the last rotation followed is not read: it would not be looked at
		if (followed < MAX_ROTATIONS_FOLLOWED) {
			token = await readIfStored(readUnderLock ?? findById, nextId);
			if (!token) {
				return null;
			}
		}
	}

	return null;
}

/**
 * The token to rotate when a token that was already rotated is presented again, or null when it is refused.
 *
 * A rotation answers a new token and refuses the old one from then on. A client whose answer was lost on the way
 * (the network dropped, the computer went to sleep, a proxy timed out) still holds the old token, and so does a
 * second window or process that sent it at the same moment: with no tolerance at all, each of them was signed out
 * of a valid session (ever-co/ever-gauzy#11955). For the type's `rotationReuseWindow` after its rotation, the old
 * token is therefore answered again.
 *
 * It is answered by rotating the token its line of rotations ends with, not with a second token beside the first
 * one: a token has one successor (`rotatedFromTokenId` is unique), so the line stays a line, with one active token
 * at its end. That end must still be active. Once the session's token is revoked (a sign-out, a password change,
 * a session signed out from another device) or has expired, the token before it opens nothing.
 *
 * The window is counted from the creation of the token that first replaced the presented one. That time never
 * changes, so presenting the old token again does not extend it.
 *
 * @param presented The stored token that was presented.
 * @param config The configuration of its type.
 * @param findById Reads a stored token.
 * @param lockAndRead Reads a stored token again under a row lock, where the database has one: the rotation gives
 *   it, so that the token it is about to rotate cannot be rotated by another request meanwhile.
 * @returns The active token its line of rotations ends with, or null.
 */
export async function findTokenToRotateAgain(
	presented: IToken,
	config: Pick<ITokenConfig, 'rotationReuseWindow'>,
	findById: ReadToken,
	lockAndRead?: ReadToken
): Promise<IToken | null> {
	const reuseWindow = config.rotationReuseWindow;
	const firstSuccessorId = nextIdOf(presented);
	if (!reuseWindow || reuseWindow <= 0 || !firstSuccessorId || tokenWithRules(presented).isExpired()) {
		return null;
	}

	const first = await readIfStored(findById, firstSuccessorId);
	const replacedAt = first ? new Date(first.createdAt).getTime() : Number.NaN;
	// Written this way round so that a time that cannot be read refuses the token
	if (!first || !(Date.now() - replacedAt <= reuseWindow)) {
		return null;
	}

	const last = await followRotations(presented, first, findById, lockAndRead);
	return last?.canRotate() ? last : null;
}

/**
 * The token a session goes on with when the token at hand was already rotated: the one its line of rotations ends
 * with, whatever its state, or null when the line cannot be followed.
 *
 * A sign-out asks for it. A client can hold a rotated token in good faith (the earlier of two answers to one
 * refresh, see `findTokenToRotateAgain`), and so can the owner of a token that someone else presented first. The
 * rotated token has nothing left to revoke itself: the session is ended by revoking the token it goes on with.
 *
 * @param rotated The stored token at hand.
 * @param findById Reads a stored token.
 */
export async function findEndOfRotationLine(rotated: IToken, findById: ReadToken): Promise<IToken | null> {
	const firstSuccessorId = nextIdOf(rotated);
	const first = firstSuccessorId ? await readIfStored(findById, firstSuccessorId) : null;
	return first ? followRotations(rotated, first, findById) : null;
}
