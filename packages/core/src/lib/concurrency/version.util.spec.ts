import {
	IF_MATCH_HEADER,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY,
	VERSION_PROPERTY,
	bumpVersion,
	evaluateVersionPrecondition,
	evaluateVersionedWrite,
	formatEntityTag,
	isReadOnlyMethod,
	matchesExpectation,
	parseEntityTag,
	parseEntityVersion,
	parseIfMatch,
	resolveExpectedVersion,
	versionFromResolverArgs
} from './version.util';

/**
 * The optimistic-concurrency decisions, asserted against fixed inputs.
 *
 * Two callers read one record and both write it back: without a version the second write erases the
 * first and nobody is told. Every decision that prevents that — what a client's `If-Match` states,
 * whether the row satisfies it, what an update that matched no rows means — is a pure function in
 * this file, so the cases below are the whole mechanism with no database, no request and no ORM
 * underneath it. The races this exists to close are asserted here as fixed inputs instead.
 *
 * The two halves of the transport meet in this file as well: a REST client states its version in a
 * header and a GraphQL client states it in the resolver's arguments, and both are reduced to the
 * same parsed expectation so the same comparison and the same codes come out. That equivalence is
 * asserted rather than assumed, because a resolver path that compared versions itself would be a
 * second implementation of the one thing this file is for.
 */

/** The precondition a GraphQL operation reaches, in the shape a caller would hand the guard. */
const fromResolver = (args: unknown) =>
	evaluateVersionPrecondition({ ifMatch: versionFromResolverArgs(args), write: true });

describe('reading what a caller accepted', () => {
	it('accepts every form a client states one version in', () => {
		// A quoted tag, a bare number and a weak tag all state version 3. Refusing any of them would
		// answer a client that stated its version correctly with "that is not a version".
		expect(parseIfMatch('"3"')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
		expect(parseIfMatch('3')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
		expect(parseIfMatch('W/"3"')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
		// Padding is a transport artefact rather than part of the version.
		expect(parseIfMatch('  "3"  ')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
	});

	it('reads a list as "either version is acceptable", in the order it was stated', () => {
		expect(parseIfMatch('"2", "3"')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [2, 3] } });
		// Control: the same version twice is one accepted version rather than two, so a list that repeats
		// a member does not read as a wider acceptance than the caller stated.
		expect(parseIfMatch('"3","3"')).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
	});

	it('reads a wildcard as "the row must exist", and states no version with it', () => {
		// Control: the empty version list is what keeps a wildcard out of the exact-version branch of
		// `matchesExpectation`. A wildcard that carried a version would answer a conflict the caller
		// never stated.
		expect(parseIfMatch('*')).toEqual({ status: 'match', expectation: { wildcard: true, versions: [] } });
		expect(parseIfMatch(' * ')).toEqual({ status: 'match', expectation: { wildcard: true, versions: [] } });
	});

	it('answers null for a header that states nothing, which is a different fact from a malformed one', () => {
		// The two answers lead to different codes: nothing stated is `428` ("state the version"), a header
		// that cannot be read is `400` ("what you sent is not a version"). Collapsing them would either
		// demand a version from a client that sent one or accept a write that stated none.
		expect(parseIfMatch(undefined)).toBeNull();
		expect(parseIfMatch(null)).toBeNull();
		expect(parseIfMatch('')).toBeNull();
		// Whitespace is nothing stated, not something unreadable: `readRequestHeader` hands over whatever
		// the client sent, and a header of spaces is a client that sent no version.
		expect(parseIfMatch('   ')).toBeNull();
	});

	it('reads a repeated header as the first value, and an empty one as nothing stated', () => {
		// Express hands a repeated header over as an array; the first value is the one addressed here.
		expect(parseIfMatch(['"3"', '"4"'])).toEqual({ status: 'match', expectation: { wildcard: false, versions: [3] } });
		// Control: an empty array must not throw and must not read as a malformed version — there is no
		// value in it to be malformed.
		expect(parseIfMatch([])).toBeNull();
	});

	it('refuses an empty list and a member that is not a version, with the reason the caller is told', () => {
		// Control: every one of these is a header that would otherwise parse to "the row must be at some
		// version" — the exact degradation, from a conditional write to an unconditional one, that this
		// mechanism exists to prevent.
		expect(parseIfMatch('abc')).toEqual({ status: 'invalid', reason: 'malformed' });
		expect(parseIfMatch('"abc"')).toEqual({ status: 'invalid', reason: 'malformed' });
		// A list with an empty member: the version before the comma is acceptable and the rest is not a
		// statement at all, so the header as a whole is refused rather than half-read.
		expect(parseIfMatch('"2",')).toEqual({ status: 'invalid', reason: 'malformed' });
		// An empty list, which is two empty members.
		expect(parseIfMatch(',')).toEqual({ status: 'invalid', reason: 'malformed' });
		// Zero is not a version — the column starts at 1 — so a header stating it is unreadable rather
		// than an accepted version nobody can hold.
		expect(parseIfMatch('0')).toEqual({ status: 'invalid', reason: 'malformed' });
		// An unbalanced quote is not a tag.
		expect(parseIfMatch('"3')).toEqual({ status: 'invalid', reason: 'malformed' });
	});

	it('refuses a version that did not arrive as text, where the tag parser accepts one', () => {
		// The two readers disagree about the numeric form: `parseEntityTag` takes the number itself, and
		// the header reader requires a string. A transport — or a test harness — that hands over `3`
		// rather than `'3'` is therefore answered `400`, although the value is the version 3.
		expect(parseEntityTag(3)).toBe(3);
		expect(parseIfMatch(3)).toEqual({ status: 'invalid', reason: 'malformed' });
	});
});

describe('the version a GraphQL operation states', () => {
	it('reads input.version first and the resolver argument second', () => {
		// A GraphQL request is one POST carrying whatever the document selected, so there is no header
		// that could say which mutation a version belongs to; it rides beside the input it qualifies.
		expect(versionFromResolverArgs({ input: { version: 3 } })).toBe('3');
		expect(versionFromResolverArgs({ version: '3' })).toBe('3');
		// A document that states both means the input member, which is the one that travels beside the
		// record the mutation names.
		expect(versionFromResolverArgs({ input: { version: 2 }, version: 3 })).toBe('2');
		// A null input states nothing rather than swallowing the argument beside it.
		expect(versionFromResolverArgs({ input: null, version: 3 })).toBe('3');
	});

	it('answers undefined when neither member is stated, so the caller answers 428', () => {
		expect(versionFromResolverArgs(undefined)).toBeUndefined();
		expect(versionFromResolverArgs(null)).toBeUndefined();
		expect(versionFromResolverArgs({})).toBeUndefined();
		expect(versionFromResolverArgs({ input: {} })).toBeUndefined();
		// A member that is present and null is "not stated". Control: a caller that sent nothing usable is
		// told to state a version, not told that what it sent is not one.
		expect(versionFromResolverArgs({ input: { version: null } })).toBeUndefined();
		expect(versionFromResolverArgs({ version: undefined })).toBeUndefined();
		// Control: an absent member and an absent argument list are the same answer, so a resolver with no
		// arguments at all is not a crash.
		expect(fromResolver({})).toEqual({ action: 'REQUIRE' });
	});

	it('passes a stated but unusable value through as text, so the caller answers 400 rather than 428', () => {
		// The distinction the guard makes: "you sent nothing" and "what you sent is not a version" are
		// different answers, and a client that sent `"three"` needs the second one.
		expect(versionFromResolverArgs({ input: { version: 'three' } })).toBe('three');
		expect(fromResolver({ input: { version: 'three' } })).toEqual({ action: 'INVALID', reason: 'malformed' });
		// Zero, a fraction and a boolean are stated values too, and none of them is a version. Control: a
		// reader that dropped a value it could not use would answer 428 to each of these, telling a client
		// that sent something that it sent nothing.
		expect(fromResolver({ input: { version: 0 } })).toEqual({ action: 'INVALID', reason: 'malformed' });
		expect(fromResolver({ input: { version: 1.5 } })).toEqual({ action: 'INVALID', reason: 'malformed' });
		expect(fromResolver({ version: true })).toEqual({ action: 'INVALID', reason: 'malformed' });
		expect(fromResolver({ input: { version: -3 } })).toEqual({ action: 'INVALID', reason: 'malformed' });
	});

	it('states a member that is present and empty as nothing at all', () => {
		// An empty string is passed through as the empty string, which the header reader trims to nothing:
		// `version: ""` is answered `428`, unlike every other stated-but-unusable value. Pinned as the
		// kernel stands, because the alternative reading — an empty string is a malformed version — is a
		// different code on the same request.
		expect(versionFromResolverArgs({ input: { version: '' } })).toBe('');
		expect(fromResolver({ input: { version: '' } })).toEqual({ action: 'REQUIRE' });
	});

	it('runs the same comparison as the header transport, so both answer the same codes', () => {
		// This is the half that makes two protocols one mechanism: the stated version goes through
		// `parseIfMatch` exactly as a header does, so a stale write is a 409 on either surface and a
		// current one proceeds on either.
		const viaHeader = evaluateVersionPrecondition({ ifMatch: '"4"', write: true, exists: true, currentVersion: 5 });
		const viaResolver = evaluateVersionPrecondition({
			ifMatch: versionFromResolverArgs({ input: { version: 4, id: 'invoice-1' } }),
			write: true,
			exists: true,
			currentVersion: 5
		});

		expect(viaResolver).toEqual(viaHeader);
		expect(viaResolver).toEqual({ action: 'CONFLICT', expectedVersion: 4, actualVersion: 5 });
		// Control: a resolver path that compared the numbers itself would answer `PROCEED` here, or a code
		// the header path never emits. The equality above is what fails when the two drift apart.
		expect(fromResolver({ input: { version: 5, id: 'invoice-1' } })).toEqual(
			evaluateVersionPrecondition({ ifMatch: '"5"', write: true })
		);
	});
});

describe('reading a version off a tag or a record', () => {
	it('reads every form of tag, and renders one back', () => {
		expect(parseEntityTag('"3"')).toBe(3);
		expect(parseEntityTag('3')).toBe(3);
		expect(parseEntityTag('W/"3"')).toBe(3);
		expect(parseEntityTag(3)).toBe(3);
		expect(parseEntityTag('  3  ')).toBe(3);
		// The round trip the transport rests on: what the interceptor publishes as an entity tag is what
		// the guard reads back out of `If-Match`. A formatter and a parser that disagreed would make every
		// conditional write a 400.
		expect(formatEntityTag(7)).toBe('"7"');
		expect(parseEntityTag(formatEntityTag(7))).toBe(7);
	});

	it('refuses zero, a negative, a non-integer and a non-numeric tag', () => {
		// Control: the column starts at 1, so zero and below is an absent version rather than an accepted
		// one. A tag parser that took `0` or `-1` would let a client predicate a write on a version no row
		// can hold, and the conditional update would match nothing for a reason nobody could see.
		expect(parseEntityTag(0)).toBeNull();
		expect(parseEntityTag(-1)).toBeNull();
		expect(parseEntityTag(1.5)).toBeNull();
		expect(parseEntityTag('0')).toBeNull();
		expect(parseEntityTag('-1')).toBeNull();
		expect(parseEntityTag('1.5')).toBeNull();
		expect(parseEntityTag('abc')).toBeNull();
		expect(parseEntityTag('')).toBeNull();
		expect(parseEntityTag(null)).toBeNull();
		expect(parseEntityTag(true)).toBeNull();
		// Beyond what a version can be counted in: a number this large cannot be a safe integer, and a
		// version that cannot be compared exactly is not a version.
		expect(parseEntityTag('99999999999999999999')).toBeNull();
	});

	it('reads a stored version from a column or a body, and refuses the quoted tag form', () => {
		expect(parseEntityVersion(3)).toBe(3);
		expect(parseEntityVersion('3')).toBe(3);
		expect(parseEntityVersion(' 3 ')).toBe(3);
		// Control: the tag form belongs to the transport. A `version` column or a response body holding
		// `"3"` is not a version, and reading it as 3 would predicate an update on a number the database
		// does not hold — matching no row and reporting a conflict that is really a broken column.
		expect(parseEntityVersion('"3"')).toBeNull();
		expect(parseEntityVersion('W/"3"')).toBeNull();
		expect(parseEntityVersion(0)).toBeNull();
		expect(parseEntityVersion(-2)).toBeNull();
		expect(parseEntityVersion(2.5)).toBeNull();
		expect(parseEntityVersion('abc')).toBeNull();
		expect(parseEntityVersion(undefined)).toBeNull();
		expect(parseEntityVersion(null)).toBeNull();
		expect(parseEntityVersion({})).toBeNull();
	});

	it('makes the first recorded write version 1, whatever the row held', () => {
		expect(bumpVersion(3)).toBe(4);
		// A row created before the entity opted in has no version, and the column's convention is
		// `NOT NULL DEFAULT 1`: the first write that records one makes it 1 rather than leaving it empty.
		expect(bumpVersion(undefined)).toBe(1);
		expect(bumpVersion(null)).toBe(1);
		expect(bumpVersion(0)).toBe(1);
		// Control: an unusable version is an absent one rather than a reason to write a fraction or a NaN —
		// a row at `0.5` would be at a version no parser on either side of the transport can read.
		expect(bumpVersion(-5)).toBe(1);
		expect(bumpVersion(2.5)).toBe(1);
		expect(parseEntityVersion(bumpVersion(parseEntityTag('"3"')))).toBe(4);
	});
});

describe('whether a row satisfies what the caller accepted', () => {
	it('matches a wildcard against any version the row actually holds', () => {
		const anyExisting = { wildcard: true, versions: [] };

		expect(matchesExpectation(anyExisting, 1)).toBe(true);
		expect(matchesExpectation(anyExisting, 4)).toBe(true);
		// Control: a wildcard is "the row must exist", and a row whose version could not be read is not
		// known to exist at a version. Answering true here would proceed on a version nobody stated.
		expect(matchesExpectation(anyExisting, undefined)).toBe(false);
		expect(matchesExpectation(anyExisting, null)).toBe(false);
	});

	it('matches an exact version and a list, and misses on anything else', () => {
		expect(matchesExpectation({ wildcard: false, versions: [3] }, 3)).toBe(true);
		expect(matchesExpectation({ wildcard: false, versions: [3] }, 4)).toBe(false);
		expect(matchesExpectation({ wildcard: false, versions: [2, 3] }, 2)).toBe(true);
		expect(matchesExpectation({ wildcard: false, versions: [2, 3] }, 3)).toBe(true);
		// Control: the second member is what makes a list a list. An implementation that compared only
		// `versions[0]` would answer "no" to a client that accepted two revisions and read the older one.
		expect(matchesExpectation({ wildcard: false, versions: [2, 3] }, 4)).toBe(false);
		expect(matchesExpectation({ wildcard: false, versions: [2, 3] }, undefined)).toBe(false);
		// An empty list accepts nothing, which is what keeps an empty parse from reading as a wildcard.
		expect(matchesExpectation({ wildcard: false, versions: [] }, 3)).toBe(false);
	});
});

describe('the precondition a request is decided by', () => {
	it('skips a read, which states no version because it changes nothing', () => {
		expect(evaluateVersionPrecondition({ write: false })).toEqual({ action: 'SKIP' });
		// Control: a read that carried a stale or unreadable header must not be refused — it cannot
		// conflict with anything, and refusing it would break every client that reuses one header on both
		// the read and the write.
		expect(evaluateVersionPrecondition({ write: false, ifMatch: '"3"', currentVersion: 4 })).toEqual({ action: 'SKIP' });
		expect(evaluateVersionPrecondition({ write: false, ifMatch: 'abc' })).toEqual({ action: 'SKIP' });
	});

	it('demands a version on a write that states none', () => {
		expect(evaluateVersionPrecondition({ write: true })).toEqual({ action: 'REQUIRE' });
		expect(evaluateVersionPrecondition({ write: true, required: true })).toEqual({ action: 'REQUIRE' });
		// Whitespace states nothing, so it is answered exactly as an absent header is.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '   ' })).toEqual({ action: 'REQUIRE' });
		// `required: false` makes the version optional: this half then has nothing to check, and the
		// conditional update is still the half that decides.
		expect(evaluateVersionPrecondition({ write: true, required: false })).toEqual({ action: 'SKIP' });
	});

	it('refuses a malformed version before the row is consulted, whatever the row says', () => {
		expect(evaluateVersionPrecondition({ write: true, ifMatch: 'abc' })).toEqual({ action: 'INVALID', reason: 'malformed' });
		// "Optional" means the caller may state none, not that a statement it did make may be ignored.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: 'abc', required: false })).toEqual({
			action: 'INVALID',
			reason: 'malformed'
		});
		// Control: the order of the checks. A malformed header on a row that is also missing is 400 rather
		// than 404, because the request itself is what cannot be understood.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: 'abc', exists: false })).toEqual({
			action: 'INVALID',
			reason: 'malformed'
		});
	});

	it('answers a row that is gone as not found rather than as a conflict', () => {
		// There is nothing to be in conflict with, and a 409 would send the caller to re-read a record
		// that is not there to read.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', exists: false })).toEqual({ action: 'NOT_FOUND' });
		// A wildcard names no version but still demands the row exist.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '*', exists: false })).toEqual({ action: 'NOT_FOUND' });
	});

	it("proceeds on the version the caller stated when the row's version is unknown", () => {
		// The comparison is deferred rather than skipped: the conditional update is predicated on the
		// stated version, which is the half that cannot be raced.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"' })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', currentVersion: null })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', exists: true, currentVersion: null })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		// An unusable stored version is an unknown one rather than a mismatch: a row whose column holds `0`
		// is not known to be at a version, so the write still pins what the caller stated. Control: reading
		// it as a version would answer 409 to every write against a row that has never recorded one.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', currentVersion: 0 })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		// Control: a wildcard with no readable version names no number to predicate on. Proceeding with a
		// guess would be the one outcome worse than not proceeding.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '*' })).toEqual({ action: 'SKIP' });
	});

	it('answers a mismatch as a conflict naming both versions', () => {
		// Control: both numbers travel. A conflict that reported only the stored version would leave the
		// caller unable to tell which of its own reads the row had moved past.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', currentVersion: 4 })).toEqual({
			action: 'CONFLICT',
			expectedVersion: 3,
			actualVersion: 4
		});
		// A list the row is not in is a miss, and the version reported as expected is the first the caller
		// stated — the one it read first.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"2", "3"', currentVersion: 4 })).toEqual({
			action: 'CONFLICT',
			expectedVersion: 2,
			actualVersion: 4
		});
	});

	it('proceeds on a match, and predicates the write on the version the row actually holds', () => {
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"3"', currentVersion: 3 })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		// The row is at 3 and the caller accepted 2 or 3: the number the update is predicated on is 3, the
		// row's own, not the first the caller listed.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"2", "3"', currentVersion: 3 })).toEqual({
			action: 'PROCEED',
			expected: 3,
			wildcard: false
		});
		// A wildcard against a known row proceeds at that row's version and stays a wildcard, so the write
		// resolves the number itself rather than trusting one read here.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '*', currentVersion: 4 })).toEqual({
			action: 'PROCEED',
			expected: 4,
			wildcard: true
		});
		// A row that exists and matches is not a 404.
		expect(evaluateVersionPrecondition({ write: true, ifMatch: '"4"', exists: true, currentVersion: 4 })).toEqual({
			action: 'PROCEED',
			expected: 4,
			wildcard: false
		});
	});
});

describe('what a conditional update produced', () => {
	it('reads a positive affected-row count as a landed write at the next version', () => {
		expect(evaluateVersionedWrite({ affected: 1, expected: 3 })).toEqual({ status: 'written', version: 4 });
		// The count is a fact about the statement rather than a number of versions: one statement predicated
		// on one version moves the row on by one.
		expect(evaluateVersionedWrite({ affected: 3, expected: 1 })).toEqual({ status: 'written', version: 2 });
		// Control: the version reported comes from what the update was predicated on, not from any read-back
		// — a row re-read after the write could already be at a version this write did not produce.
		expect(evaluateVersionedWrite({ affected: 1, expected: 3, actualVersion: 99 })).toEqual({
			status: 'written',
			version: 4
		});
	});

	it('reads a row that is gone as missing, whatever version was expected', () => {
		expect(evaluateVersionedWrite({ affected: 0, expected: 3, exists: false })).toEqual({ status: 'missing' });
		// Control: a row deleted between the caller's read and this write is not a conflict. Reporting one
		// would tell the caller to re-read a record that is not there.
		expect(evaluateVersionedWrite({ affected: 0, expected: 3, exists: false, actualVersion: 5 })).toEqual({
			status: 'missing'
		});
	});

	it('reads a row that moved on as a conflict naming both versions', () => {
		expect(evaluateVersionedWrite({ affected: 0, expected: 3, exists: true, actualVersion: 5 })).toEqual({
			status: 'conflict',
			expectedVersion: 3,
			actualVersion: 5
		});
	});

	it('reports a conflict whose actual version could not be read without inventing one', () => {
		const outcome = evaluateVersionedWrite({ affected: 0, expected: 3 });

		expect(outcome).toEqual({ status: 'conflict', expectedVersion: 3 });
		// Control: the two numbers are what a client branches on. An `actualVersion` of 0, null or undefined
		// would read as a version the row is at, and the client would send it straight back as `If-Match`.
		expect(outcome).not.toHaveProperty('actualVersion');
		expect(evaluateVersionedWrite({ affected: 0, expected: 3, actualVersion: 0 })).not.toHaveProperty('actualVersion');
		expect(evaluateVersionedWrite({ affected: 0, expected: 3, actualVersion: null })).not.toHaveProperty('actualVersion');
	});
});

describe('resolving the version to predicate on', () => {
	it('takes the one version a caller stated without reading the row', async () => {
		const read = jest.fn(async () => 9);

		expect(await resolveExpectedVersion({ wildcard: false, versions: [3] }, read)).toBe(3);
		// Control: a read that is not needed is a round trip that can fail and a window that can open. A
		// caller that stated exactly one version has already answered the question.
		expect(read).not.toHaveBeenCalled();
	});

	it('reads the row when the caller stated a condition rather than a number', async () => {
		// A list, or a wildcard, is a condition: the number has to come from the row, and the update is
		// still predicated on it — which is what keeps the comparison and the write one statement even for
		// a caller that named no version at all.
		expect(await resolveExpectedVersion({ wildcard: false, versions: [2, 3] }, async () => 3)).toBe(3);
		expect(await resolveExpectedVersion({ wildcard: true, versions: [] }, async () => 7)).toBe(7);
	});

	it('answers null when the row cannot be read, rather than a version it did not see', async () => {
		expect(await resolveExpectedVersion({ wildcard: true, versions: [] }, async () => null)).toBeNull();
		expect(await resolveExpectedVersion({ wildcard: false, versions: [2, 3] }, async () => null)).toBeNull();
		// Control: an unusable value read off the row is not a version. Guessing here would predicate the
		// update on a number the row has never held, which matches nothing and reports a conflict.
		expect(await resolveExpectedVersion({ wildcard: true, versions: [] }, async () => 0)).toBeNull();
	});
});

describe('the names the convention fixes', () => {
	it('states the column, the header, the metadata key and the request property', () => {
		// These four strings are the contract between the decorator, the guard, the interceptor and the
		// write helper, and the first of them is a database convention besides: renaming any of them
		// detaches the protection from the route or the entity that opted in, silently.
		expect(VERSION_PROPERTY).toBe('version');
		expect(IF_MATCH_HEADER).toBe('if-match');
		expect(VERSIONED_METADATA_KEY).toBe('VERSIONED_METADATA');
		expect(VERSION_EXPECTATION_PROPERTY).toBe('versionExpectation');
	});

	it('treats only the three safe methods as reads', () => {
		expect(isReadOnlyMethod('GET')).toBe(true);
		expect(isReadOnlyMethod('head')).toBe(true);
		expect(isReadOnlyMethod('OPTIONS')).toBe(true);
		expect(isReadOnlyMethod('POST')).toBe(false);
		expect(isReadOnlyMethod('PUT')).toBe(false);
		expect(isReadOnlyMethod('PATCH')).toBe(false);
		expect(isReadOnlyMethod('DELETE')).toBe(false);
		// Control: an absent method is not a read. Defaulting to "read" would skip the check on a request
		// whose method the transport did not report — which is exactly the write that must not be skipped.
		expect(isReadOnlyMethod(undefined)).toBe(false);
		expect(isReadOnlyMethod('')).toBe(false);
	});
});
