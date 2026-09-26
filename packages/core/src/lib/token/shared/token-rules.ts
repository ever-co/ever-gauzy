import { IToken } from '../interfaces';
// The entity itself rather than a barrel: `shared/index.ts` is imported across the token module, and it must not
// pull the entity graph in with it (see the note on require cycles in `token.repository.ts`).
import { Token } from '../entities/token.entity';

/**
 * A stored token that answers its own rules — `isUsable`, `isExpired`, `canRevoke` and the rest — whichever ORM
 * read it.
 *
 * `IToken` declares the rules, and `Token` implements them, so the handlers ask the record they read. On TypeORM
 * that record is a `Token`, and it is answered as it is: every rule is the call it always was, on the entity
 * itself. On MikroORM `TokenRepository` reads through the CRUD base, which answers `wrap(entity).toJSON()` — the
 * row's data as a plain object, without the entity's prototype — so the first rule a handler asked for failed:
 * `tokenRecord.isUsable is not a function` on every validation (the refresh-token strategy, the refresh that
 * rotates a token, the access-token check), and `token.canRevoke is not a function` on every revocation, which
 * logout asks for both of the session's tokens and only logs when it fails — so on MikroORM a logged-out session's
 * tokens stayed active.
 *
 * Calling `Token`'s method with the plain row as `this` is not enough here, because the rules are built on one
 * another (`isUsable` asks `this.isActivated()`, `canRevoke` asks `this.canRotate()`), and the row has none of
 * them. The row is therefore read through an object whose prototype is `Token`'s and whose own members are the
 * row's, defined rather than assigned, so no accessor MikroORM places on the entity prototype runs. The rules read
 * only the token's own columns and relation-id mirrors, which the serialized row states exactly as TypeORM's
 * entity does (no relation is read, loaded or not), and none of them writes, so the view answers what the entity
 * would and leaves the row as it was read.
 *
 * @param record The token, as the repository answered it.
 * @returns The record itself when it carries its rules, and otherwise a view of it that does.
 */
export function tokenWithRules<T extends IToken>(record: T): T {
	if (typeof record.isUsable === 'function') {
		return record;
	}

	return Object.create(Token.prototype, Object.getOwnPropertyDescriptors(record));
}
