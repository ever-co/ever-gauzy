/**
 * The `User` columns that must never leave the API. They mirror the entity's
 * `@Exclude({ toPlainOnly: true })` set.
 */
export const USER_CREDENTIAL_KEYS: ReadonlyArray<string> = [
	'hash',
	'refreshToken',
	'code',
	'codeExpireAt',
	'emailToken',
	'emailVerifiedAt'
];

/**
 * True for a plain object or array: the only shapes `instanceToPlain` output needs walking through.
 * Dates, buffers, streams and other class instances are left alone.
 */
function isWalkable(value: unknown): value is Record<string, unknown> | unknown[] {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	if (Array.isArray(value)) {
		return true;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

/**
 * Credential columns whose NAME belongs to `User` alone (no other entity or response DTO in the
 * repository declares one), so their presence identifies a serialized user.
 *
 * `code`, `codeExpireAt` and `emailVerifiedAt` are deliberately NOT in this list: `code` is an
 * ordinary field on `Invite`, `OrganizationTeamJoinRequest`, currencies and products — and the first
 * two carry an `email` too, so keying off it would strip a legitimate field.
 */
const USER_IDENTIFYING_KEYS: ReadonlyArray<string> = ['hash', 'refreshToken', 'emailToken'];

/**
 * True for an object shaped like a serialized `User`: it has an `email` plus at least one column
 * that only `User` has.
 *
 * Deliberately narrow, and matched on more than `hash` alone: a MikroORM read that projects only
 * some columns (`?select[...]`) can hand back a user WITHOUT `hash` but with `emailToken` or
 * `refreshToken`, which a `hash`-only test would wave through.
 */
function isUserShaped(value: Record<string, unknown>): boolean {
	return 'email' in value && USER_IDENTIFYING_KEYS.some((key) => key in value);
}

/**
 * Scrubs ONE node and reports the values that still have to be walked.
 *
 * An array holds no keys of its own, so only its items are handed back; a user-shaped object loses
 * its credential columns first, so they are never returned as children either.
 *
 * @param node A plain object or array from the response body (mutated in place).
 * @returns The node's child values, to be walked in turn.
 */
function scrubNode(node: Record<string, unknown> | unknown[]): unknown[] {
	if (Array.isArray(node)) {
		return node;
	}
	if (isUserShaped(node)) {
		for (const key of USER_CREDENTIAL_KEYS) {
			delete node[key];
		}
	}
	return Object.values(node);
}

/**
 * Last line of defense for GHSA-hh83-hq74-gh9f: removes the credential columns from every
 * `User`-shaped object in an already-serialized response body (mutated in place).
 *
 * `@Exclude` only works on a real `User` instance, because class-transformer finds the metadata
 * through the prototype. A prototype-less user — an object spread of an entity, or the plain objects
 * that `CrudService.serialize()` returns under DB_ORM=mikro-orm (`wrap(entity).toJSON()`) — was
 * serialized with its password hash, refresh token and one-time codes. This runs AFTER
 * `instanceToPlain`, so real instances are already clean and this is a no-op for them.
 *
 * @param data The response body produced by `instanceToPlain`.
 * @returns The same value, with credentials removed from every user-shaped object.
 */
export function scrubUserCredentials<T>(data: T): T {
	if (!isWalkable(data)) {
		return data;
	}

	const seen = new WeakSet<object>();
	const stack: Array<Record<string, unknown> | unknown[]> = [data];

	while (stack.length) {
		const node = stack.pop();
		if (!node || seen.has(node)) {
			continue;
		}
		seen.add(node);

		for (const child of scrubNode(node)) {
			if (isWalkable(child)) {
				stack.push(child);
			}
		}
	}

	return data;
}
