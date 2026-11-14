import { IToken, ITokenConfig, TokenStatus } from '../interfaces';
import { tokenWithRules } from './token-rules';

/** How many rotations are followed from the token that was presented before the search gives up. */
const MAX_ROTATIONS_FOLLOWED = 20;

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
 * @returns The active token its line of rotations ends with, or null.
 */
export async function findTokenToRotateAgain(
	presented: IToken,
	config: Pick<ITokenConfig, 'rotationReuseWindow'>,
	findById: (id: string) => Promise<IToken | null>
): Promise<IToken | null> {
	const reuseWindow = config.rotationReuseWindow;
	const firstSuccessorId = presented.status === TokenStatus.ROTATED ? successorIdOf(presented) : null;
	if (!reuseWindow || reuseWindow <= 0 || !firstSuccessorId || tokenWithRules(presented).isExpired()) {
		return null;
	}

	let successor = await findById(firstSuccessorId);
	const replacedAt = successor ? new Date(successor.createdAt).getTime() : Number.NaN;
	// Written this way round so that a time that cannot be read refuses the token
	if (!(Date.now() - replacedAt <= reuseWindow)) {
		return null;
	}

	for (let followed = 0; followed < MAX_ROTATIONS_FOLLOWED; followed += 1) {
		const isOfTheSameLine = successor.userId === presented.userId && successor.tokenType === presented.tokenType;
		if (!isOfTheSameLine) {
			return null;
		}
		const nextId = successor.status === TokenStatus.ROTATED ? successorIdOf(successor) : null;
		if (!nextId) {
			const last = tokenWithRules(successor);
			return last.canRotate() ? last : null;
		}
		successor = await findById(nextId);
		if (!successor) {
			return null;
		}
	}

	return null;
}
