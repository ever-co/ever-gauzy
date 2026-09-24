/**
 * The optimistic-concurrency decisions, kept apart from the transport and the ORM.
 *
 * Two clients read the same record and both write it back. Without a version, the second write
 * silently erases the first — last writer wins, and the first client never learns that the value it
 * based its change on is gone. The fix is a version the caller states and the server checks, and
 * every decision that involves one is made here: how a precondition header is read, whether it
 * matches what the database holds, and what an update that matched nothing means.
 *
 * Free of NestJS and of both ORMs on purpose. The interesting cases — a stale version, a wildcard,
 * a weak tag, two accepted versions, an update whose affected-row count is zero — are assertions
 * against fixed inputs here, rather than a race that has to be reproduced against two databases.
 */

/** Version column name, and the property the entity that opts in declares. */
export const VERSION_PROPERTY = 'version';

/** The header a conditional write states its version in. */
export const IF_MATCH_HEADER = 'if-match';

/** Metadata key the `@Versioned()` decorator writes and the guard and interceptor read. */
export const VERSIONED_METADATA_KEY = 'VERSIONED_METADATA';

/** The request property the guard leaves the accepted version on, for the write to consume. */
export const VERSION_EXPECTATION_PROPERTY = 'versionExpectation';

/**
 * Whether a method leaves the record alone.
 *
 * A read states no version: the caller is not asking to change anything, so demanding a
 * precondition would refuse a request that cannot conflict with anything.
 *
 * @param method The HTTP method.
 * @returns True for the methods that do not write.
 */
export function isReadOnlyMethod(method?: string): boolean {
	const normalized = String(method ?? '').toUpperCase();

	return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
}

/**
 * Why a precondition header could not be used.
 *
 * `malformed` is separated from a missing header because the two are different answers: a missing
 * header is `428` ("state the version"), a header that cannot be parsed is `400` ("what you sent is
 * not a version").
 */
export type VersionParseFailure = 'malformed';

/** What a caller accepted in its `If-Match` header. */
export interface IVersionExpectation {
	/** `*` — any version that exists. */
	wildcard: boolean;
	/** The versions the caller accepted, in the order it stated them. Empty for a wildcard. */
	versions: number[];
	/**
	 * The table whose row the stated version is a version of, when the route declared one.
	 *
	 * Absent, the version belongs to the record the route itself writes. See
	 * `IVersionedOptions.target` for why a route would name another one.
	 */
	target?: string;
}

/**
 * The result of reading an `If-Match` header.
 *
 * The discriminant is a string rather than a boolean on purpose: this package compiles without
 * `strictNullChecks`, and under that setting a negated boolean discriminant (`if (!parsed.ok)`) does
 * not narrow the union — a member of the wrong branch would type-check and fail at runtime instead.
 */
export type IfMatchParse =
	| { status: 'match'; expectation: IVersionExpectation }
	| { status: 'invalid'; reason: VersionParseFailure };

/** What the guard must do with a request, decided from the header and the row it names. */
export type VersionPrecondition =
	| { action: 'SKIP' }
	| { action: 'REQUIRE' }
	| { action: 'INVALID'; reason: VersionParseFailure }
	| { action: 'NOT_FOUND' }
	| { action: 'PROCEED'; expected: number; wildcard: boolean }
	| { action: 'CONFLICT'; expectedVersion: number; actualVersion: number };

/** What an update that ran under a version precondition produced. */
export type VersionedWriteOutcome =
	| { status: 'written'; version: number }
	| { status: 'conflict'; expectedVersion: number; actualVersion?: number }
	| { status: 'missing' };

/**
 * Reads an `If-Match` header.
 *
 * Clients differ, so the parser is deliberately generous about form and strict about meaning. All
 * of these state version 3: `"3"`, `3` as it arrives, `W/"3"`. A list states that either version is
 * acceptable, which is what a client that has seen two revisions of the same row sends. `*` states
 * only that the row must exist. Whitespace and an empty list are refused rather than guessed at: a
 * header that parses to nothing would turn a conditional write into an unconditional one, which is
 * the exact failure this mechanism exists to prevent.
 *
 * **A header value is text**, so this refuses anything that did not arrive as one — a number reaching
 * here means a caller built the argument itself rather than taking it off a request, and
 * `parseEntityTag` is the function that reads a value of any type. `versionFromResolverArgs` is where
 * a GraphQL operation's numeric `version` member is turned into the text this expects, so both
 * transports arrive at the same comparison without this parser having to guess at a type.
 *
 * @param header The raw header value, as it arrived.
 * @returns The parsed expectation, or why it could not be used.
 */
export function parseIfMatch(header: unknown): IfMatchParse | null {
	const raw = Array.isArray(header) ? header[0] : header;

	if (raw === undefined || raw === null) {
		return null;
	}

	if (typeof raw !== 'string') {
		return { status: 'invalid', reason: 'malformed' };
	}

	const value = raw.trim();

	if (!value) {
		return null;
	}

	if (value === '*') {
		return { status: 'match', expectation: { wildcard: true, versions: [] } };
	}

	const versions: number[] = [];

	for (const part of value.split(',')) {
		const version = parseEntityTag(part);

		if (version === null) {
			return { status: 'invalid', reason: 'malformed' };
		}

		if (!versions.includes(version)) {
			versions.push(version);
		}
	}

	return versions.length
		? { status: 'match', expectation: { wildcard: false, versions } }
		: { status: 'invalid', reason: 'malformed' };
}

/**
 * The version a GraphQL operation states.
 *
 * A GraphQL request is one `POST` carrying whatever the document selected, so there is no header
 * that could say which of three mutations in it a version belongs to. The version therefore travels
 * beside the input it qualifies — `input.version` on an update, or `version` where the resolver takes
 * it as its own argument — and this turns either into the shape {@link parseIfMatch} already reads,
 * so both transports run the same comparison and answer the same codes.
 *
 * The members are read in the order a resolver is most likely to declare them, and a member that is
 * present but unusable is passed through rather than ignored: a client that sent `version: "three"`
 * has made a mistake, and answering it with `428` would say it sent nothing.
 *
 * @param args The resolver's arguments, as Nest hands them over.
 * @returns The stated version in `If-Match` form, or undefined when none was stated.
 */
export function versionFromResolverArgs(args: any): string | undefined {
	for (const candidate of [args?.input?.version, args?.version]) {
		if (candidate === undefined || candidate === null) {
			continue;
		}

		// Any stated value is passed on, whatever its type: `parseEntityTag` decides whether it is a
		// version, and a value it refuses becomes `400` rather than silence.
		return String(candidate);
	}

	return undefined;
}

/**
 * Reads one entity tag, in any of the forms a client sends.
 *
 * @param value One member of the header, for example `"3"` or `3`.
 * @returns The version, or null when the member is not a version.
 */
export function parseEntityTag(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value > 0 ? value : null;
	}

	if (typeof value !== 'string') {
		return null;
	}

	// A weak tag (`W/"3"`) means "semantically equivalent" and is not a strong match by the letter of
	// the specification. Refusing it would answer `400` to a client whose only sin is a weaker claim
	// than it needed to make, and the version comparison still protects the row, so it is accepted.
	const tag = value.trim().replace(/^W\//i, '').trim();
	const unwrapped = tag.startsWith('"') && tag.endsWith('"') ? tag.slice(1, -1) : tag;

	if (!/^[0-9]+$/.test(unwrapped)) {
		return null;
	}

	const version = Number(unwrapped);

	return Number.isSafeInteger(version) && version > 0 ? version : null;
}

/**
 * Reads the version off a record or a response body.
 *
 * @param value The candidate value.
 * @returns The version, or null when the value carries none.
 */
export function parseEntityVersion(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value > 0 ? value : null;
	}

	if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) {
		const version = Number(value.trim());

		return Number.isSafeInteger(version) && version > 0 ? version : null;
	}

	return null;
}

/**
 * Renders a version as the entity tag it is published as.
 *
 * @param version The version.
 * @returns The quoted entity tag.
 */
export function formatEntityTag(version: number): string {
	return `"${version}"`;
}

/**
 * The version a successful write leaves behind.
 *
 * A row whose version is absent or unusable is treated as being at zero, so the first recorded
 * write makes it 1 rather than leaving the column without a value. That keeps the column's
 * `NOT NULL DEFAULT 1` convention true for a row created before the entity opted in.
 *
 * @param current The version read from the row.
 * @returns The next version.
 */
export function bumpVersion(current?: number | null): number {
	const base = typeof current === 'number' && Number.isInteger(current) && current > 0 ? current : 0;

	return base + 1;
}

/**
 * Whether a row's version satisfies what the caller accepted.
 *
 * @param expectation What the caller stated.
 * @param actual The version the row holds.
 * @returns True when the write may proceed.
 */
export function matchesExpectation(expectation: IVersionExpectation, actual?: number | null): boolean {
	if (expectation.wildcard) {
		return typeof actual === 'number';
	}

	return typeof actual === 'number' && expectation.versions.includes(actual);
}

/**
 * Decides whether a conditional request may run.
 *
 * The order of the checks is the design: a read states nothing, a write states a version, a
 * statement that cannot be parsed is refused before the database is consulted, and a row that is
 * not there is `404` rather than a version conflict — there is nothing to be in conflict with.
 *
 * @param input The request's precondition and everything known about the row it names.
 * @returns What the caller must do.
 */
export function evaluateVersionPrecondition(input: {
	/** The raw `If-Match` header. */
	ifMatch?: unknown;
	/** Whether this request changes the row. A read states no version. */
	write: boolean;
	/** Whether the route insists on a version. Defaults to true. */
	required?: boolean;
	/** Whether the row exists, when that is known without a second read. */
	exists?: boolean;
	/** The version the row holds, when that is known. */
	currentVersion?: number | null;
}): VersionPrecondition {
	if (!input.write) {
		return { action: 'SKIP' };
	}

	const parsed = parseIfMatch(input.ifMatch);

	if (!parsed) {
		return input.required === false ? { action: 'SKIP' } : { action: 'REQUIRE' };
	}

	if (parsed.status === 'invalid') {
		return { action: 'INVALID', reason: parsed.reason };
	}

	if (input.exists === false) {
		return { action: 'NOT_FOUND' };
	}

	const actual = parseEntityVersion(input.currentVersion);

	if (actual === null) {
		// The row's version is unknown: the write still pins the version the caller stated, and the
		// conditional update is what decides the outcome. This is the pre-handler half of the check,
		// not the only half.
		const stated = parsed.expectation.wildcard ? null : parsed.expectation.versions[0];

		return stated === null
			? { action: 'SKIP' }
			: { action: 'PROCEED', expected: stated, wildcard: false };
	}

	if (!matchesExpectation(parsed.expectation, actual)) {
		return {
			action: 'CONFLICT',
			expectedVersion: parsed.expectation.wildcard ? actual : parsed.expectation.versions[0],
			actualVersion: actual
		};
	}

	return { action: 'PROCEED', expected: actual, wildcard: parsed.expectation.wildcard };
}

/**
 * Decides what an update that ran under a version precondition produced.
 *
 * The affected-row count is the whole answer, and that is the point: the check and the write are
 * one statement, so there is no window between reading a version and acting on it. Zero rows
 * affected means the row moved on — or was deleted — between the caller's read and this write, and
 * both of those are reported rather than absorbed.
 *
 * @param input The outcome of the conditional update.
 * @returns Whether the write landed, and at which version.
 */
export function evaluateVersionedWrite(input: {
	/** How many rows the conditional update affected. */
	affected: number;
	/** The version the update was predicated on. */
	expected: number;
	/** The version the row holds now, when it could be read back. */
	actualVersion?: number | null;
	/** Whether the row still exists, when that is known. */
	exists?: boolean;
}): VersionedWriteOutcome {
	if (input.affected > 0) {
		return { status: 'written', version: bumpVersion(input.expected) };
	}

	if (input.exists === false) {
		return { status: 'missing' };
	}

	const actual = parseEntityVersion(input.actualVersion);

	return {
		status: 'conflict',
		expectedVersion: input.expected,
		...(actual === null ? {} : { actualVersion: actual })
	};
}

/**
 * Resolves the version a conditional update must be predicated on.
 *
 * A caller that stated exactly one version has already answered this. A caller that accepted
 * several, or any existing version, has stated a condition rather than a number, so the number has
 * to come from the row — and the update is still predicated on it, which is what keeps the
 * comparison and the write in one statement.
 *
 * @param expectation What the caller stated.
 * @param readCurrent A reader for the row's version, called only when it is needed.
 * @returns The version to predicate on, or null when the row cannot be read.
 */
export async function resolveExpectedVersion(
	expectation: IVersionExpectation,
	readCurrent: () => Promise<number | null>
): Promise<number | null> {
	if (!expectation.wildcard && expectation.versions.length === 1) {
		return expectation.versions[0];
	}

	return parseEntityVersion(await readCurrent());
}
