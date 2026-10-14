/**
 * The kernel's conditional write, doubled for the suites that mock the package barrel.
 *
 * This module is a double and is used only where the package barrel is mocked at the module
 * boundary. The specs of `packages/plugins/inventory` replace the whole `@gauzy/core` module,
 * because the barrel boots the application graph from it and its nested `uuid` is ESM-only under
 * jest; a factory that replaces a module answers for every name the code under test imports from
 * it, and `commitVersionedUpdate` and `versionExpectationOf` are two of those names. The seven
 * factories that need them take them from here, so the behaviour they stand in for is written once
 * rather than seven times.
 *
 * The contract reproduced is `packages/core/src/lib/concurrency/versioned-write.ts`, together with
 * the decisions it delegates to `packages/core/src/lib/concurrency/version.util.ts`:
 *
 * 1. `expected` is the single version the caller stated, or — for a wildcard, or for a list naming
 *    several versions — the version the row reports when asked, read as a positive version.
 * 2. An `expected` that cannot be read is a `404` carrying `RESOURCE_NOT_FOUND`: there is no record
 *    the write could be predicated on.
 * 3. `next` is `expected + 1`, and the write is one statement predicated on `expected` —
 *    `update({ id, version: expected, …where }, { …patch, version: next })` — so nothing is decided
 *    between the comparison and the write.
 * 4. The affected-row count is the whole answer: TypeORM reports it as `affected`, and a result
 *    that carries only the written row counts as one.
 * 5. One affected row means the record is now at `next`, and that version is the answer.
 * 6. Zero affected rows means the record moved on or is gone, and the read-back decides which: a
 *    record that is no longer there is `404 RESOURCE_NOT_FOUND`, and a record that is still there —
 *    at the expected version or at any other — is `409 ENTITY_VERSION_CONFLICT`. The affected-row
 *    count is the whole answer, exactly as it is in the kernel: an update that matched nothing did
 *    not write, and reporting it as a write is how a ledger row ends up explaining a level change
 *    that never landed.
 *
 * The double decides rather than succeeds. It compares, it reads back, and it refuses — so a suite
 * that leans on it exercises the same three outcomes the kernel produces, and a write that should
 * have been refused is refused here too.
 */
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { STATUS_CODES } from 'http';

/** The code a refused write carries when the record it named is gone. */
const RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND';

/** The code a refused write carries when the record moved past the version the caller accepted. */
const ENTITY_VERSION_CONFLICT = 'ENTITY_VERSION_CONFLICT';

/** The code a request that states no version at all is refused with. */
const VERSION_REQUIRED = 'VERSION_REQUIRED';

/** The request property the platform's guard leaves the accepted version on. */
const VERSION_EXPECTATION_PROPERTY = 'versionExpectation';

/** What a caller accepted in its `If-Match` header. */
export interface IVersionExpectation {
	/** `*` — any version that exists. */
	wildcard: boolean;
	/** The versions the caller accepted, in the order it stated them. Empty for a wildcard. */
	versions: number[];
}

/** What a conditional write is told to do. */
export interface IVersionedWriteOptions {
	/** The record's id. */
	id: unknown;
	/** What the caller accepted. */
	expectation: IVersionExpectation;
	/** The columns to write. The version is set by this helper and is not part of the patch. */
	patch: Record<string, unknown>;
	/** Extra criteria the row must satisfy, for example the tenant and organization scope. */
	where?: Record<string, unknown>;
	/** A reader for the row's version, for a caller that already has the row in hand. */
	readVersion?: () => Promise<number | null>;
}

/** The storage surface a conditional write is handed: an update, and a read back by id. */
export interface IVersionedWriterService {
	/** Runs the update and reports how many rows it changed. */
	update(criteria: Record<string, unknown>, patch: Record<string, unknown>): Promise<unknown>;
	/** Reads one record back by its id, or answers with nothing when it is gone. */
	findOneByIdString(id: any): Promise<unknown>;
}

/**
 * A refusal that names its status and its machine-readable code.
 *
 * The real helper throws `ApiException`, which cannot be asked of a barrel that is mocked. This
 * carries the same three-key body Nest produces for every other `HttpException` — `statusCode`,
 * `error`, `message` — and the same readable `code` property, so the caller under test branches on
 * the same value it branches on in production and a spec asserts the same value it asserts there.
 */
export class VersionedWriteException extends HttpException {
	/** The catalogued code a client branches on. */
	readonly code: string;

	/** Structured context for the refusal. */
	readonly details?: Record<string, unknown>;

	/**
	 * @param status The HTTP status the answer carries.
	 * @param code The catalogued code.
	 * @param message The human-facing message.
	 * @param details Optional structured context.
	 */
	constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
		super({ statusCode: status, error: STATUS_CODES[status] ?? 'Error', message }, status);
		this.code = code;
		this.details = details;
	}
}

/**
 * The version this request must be predicated on.
 *
 * The guard leaves what the caller accepted on the request, and the write reads it from there
 * rather than parsing the header again, so the value the guard validated is the value the write is
 * predicated on. A request that states nothing is refused rather than run unconditionally: an
 * opt-in that quietly degrades to last-write-wins is worse than no opt-in, because the caller
 * believes it is protected.
 *
 * @param request The request the guard ran on.
 * @returns What the caller accepted.
 * @throws HttpException with status `428` when the request states no version.
 */
export function versionExpectationOf(request: any): IVersionExpectation {
	const expectation = request?.[VERSION_EXPECTATION_PROPERTY];

	if (!expectation) {
		throw new VersionedWriteException(
			HttpStatus.PRECONDITION_REQUIRED,
			VERSION_REQUIRED,
			'This write must state the version it was based on, and no version was accepted for it.'
		);
	}

	return expectation as IVersionExpectation;
}

/**
 * Writes a record under the version the caller read, or refuses.
 *
 * The comparison and the write are one statement — `UPDATE … SET version = :next … WHERE id = :id
 * AND version = :expected` — so there is no window between deciding and acting. The affected-row
 * count is the whole answer: one row means the write landed and the record is now at the next
 * version, and zero means the record moved on, or was deleted, between the caller's read and this
 * statement.
 *
 * @param service The record's storage surface.
 * @param options The record, what the caller accepted and what to write.
 * @returns The version the record now holds.
 * @throws VersionedWriteException with `ENTITY_VERSION_CONFLICT` when the version moved on, or
 * with `RESOURCE_NOT_FOUND` when the record is gone.
 */
export async function commitVersionedUpdate(
	service: IVersionedWriterService,
	options: IVersionedWriteOptions
): Promise<{ version: number }> {
	const readCurrent = options.readVersion ?? (() => readStoredVersion(service, options.id));
	const expected = await resolveExpectedVersion(options.expectation, readCurrent);

	if (expected === null) {
		throw new VersionedWriteException(
			HttpStatus.NOT_FOUND,
			RESOURCE_NOT_FOUND,
			'The requested record was not found.',
			{ id: options.id }
		);
	}

	const nextVersion = bumpVersion(expected);
	const criteria: Record<string, unknown> = {
		id: options.id,
		version: expected,
		...(options.where ?? {})
	};

	const result = await service.update(criteria, { ...options.patch, version: nextVersion });
	const affected = readAffected(result);

	if (affected > 0) {
		return { version: nextVersion };
	}

	const state = await readRowState(service, options.id);
	const outcome = evaluateVersionedWrite({
		affected,
		expected,
		...(state.exists === undefined ? {} : { exists: state.exists }),
		...(state.actualVersion === undefined ? {} : { actualVersion: state.actualVersion })
	});

	if (outcome.status === 'written') {
		return { version: outcome.version };
	}

	if (outcome.status === 'missing') {
		throw new VersionedWriteException(
			HttpStatus.NOT_FOUND,
			RESOURCE_NOT_FOUND,
			'The requested record was not found.',
			{ id: options.id }
		);
	}

	throw new VersionedWriteException(
		HttpStatus.CONFLICT,
		ENTITY_VERSION_CONFLICT,
		'The record changed since you read it. Read it again and reapply your change.',
		{
			expectedVersion: outcome.expectedVersion,
			...(outcome.actualVersion === undefined ? {} : { actualVersion: outcome.actualVersion })
		}
	);
}

/**
 * The version a conditional write must be predicated on.
 *
 * A caller that stated exactly one version has answered this already. A caller that accepted
 * several versions, or any version that exists, has stated a condition rather than a number, so the
 * number comes from the record — and the write is still predicated on it, which is what keeps the
 * comparison and the write in one statement.
 *
 * @param expectation What the caller stated.
 * @param readCurrent A reader for the record's version, called only when it is needed.
 * @returns The version to predicate on, or null when the record cannot be read.
 */
async function resolveExpectedVersion(
	expectation: IVersionExpectation,
	readCurrent: () => Promise<number | null>
): Promise<number | null> {
	if (!expectation.wildcard && expectation.versions.length === 1) {
		return expectation.versions[0];
	}

	return parseEntityVersion(await readCurrent());
}

/**
 * The version a successful write leaves behind.
 *
 * A record whose version is absent or unusable is treated as being at zero, so the first recorded
 * write makes it one rather than leaving the column without a value.
 *
 * @param current The version read from the record.
 * @returns The next version.
 */
function bumpVersion(current?: number | null): number {
	const base = typeof current === 'number' && Number.isInteger(current) && current > 0 ? current : 0;

	return base + 1;
}

/**
 * Reads the version off a record, or off a value a record reported.
 *
 * @param value The candidate value.
 * @returns The version, or null when the value carries none.
 */
function parseEntityVersion(value: unknown): number | null {
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
 * How many rows an update changed, whichever ORM answered.
 *
 * An update that matched nothing is the interesting answer: it is read as zero rather than as a
 * failure, so the read-back below is what explains it.
 *
 * @param result What the update returned.
 * @returns The affected-row count.
 */
function readAffected(result: unknown): number {
	const candidate = result as { affected?: unknown; id?: unknown } | null | undefined;

	if (typeof candidate?.affected === 'number') {
		return candidate.affected;
	}

	return candidate?.id ? 1 : 0;
}

/**
 * Reads a record's version from storage.
 *
 * @param service The record's storage surface.
 * @param id The record id.
 * @returns The version, or null when the record is gone or carries none.
 */
async function readStoredVersion(service: IVersionedWriterService, id: unknown): Promise<number | null> {
	const state = await readRowState(service, id);

	return state.exists === false ? null : state.actualVersion ?? null;
}

/**
 * Reads what a record currently looks like.
 *
 * @param service The record's storage surface.
 * @param id The record id.
 * @returns Its version and whether it exists, as far as that could be determined.
 */
async function readRowState(
	service: IVersionedWriterService,
	id: unknown
): Promise<{ actualVersion?: number | null; exists?: boolean }> {
	try {
		const row = await service.findOneByIdString(id);

		return { actualVersion: parseEntityVersion((row as any)?.['version']), exists: !!row };
	} catch (error) {
		if (error instanceof NotFoundException) {
			return { exists: false };
		}

		// The read-back is diagnostic: it explains a conflict and distinguishes a deleted record from
		// one that moved. Failing the request because the explanation could not be produced would
		// report a conflict as a server error, so the conflict stands without it.
		return {};
	}
}

/**
 * Decides what an update that ran under a version precondition produced.
 *
 * @param input The outcome of the conditional update.
 * @returns Whether the write landed, and at which version.
 */
function evaluateVersionedWrite(input: {
	affected: number;
	expected: number;
	actualVersion?: number | null;
	exists?: boolean;
}): { status: 'written'; version: number } | { status: 'conflict'; expectedVersion: number; actualVersion?: number } | { status: 'missing' } {
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
