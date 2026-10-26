/**
 * The kernel's conditional write, doubled for the suites that mock the package barrel.
 *
 * This module is a double and is used only where `@gauzy/core` is replaced at the module boundary.
 * The specs of this package replace the whole barrel, because the barrel boots the application graph
 * and its nested `uuid` is ESM-only under jest; a factory that replaces a module has to answer for
 * every name the code under test imports from it, and `commitVersionedUpdate` is one of those names.
 * It is written once here rather than in each factory, and it is the same shape the inventory package
 * keeps at `packages/plugins/inventory/src/lib/testing/versioned-write.double.ts`.
 *
 * The contract reproduced is `packages/core/src/lib/concurrency/versioned-write.ts` together with the
 * decisions it delegates to `version.util.ts`:
 *
 * 1. `expected` is the single version the caller stated, or — for a wildcard, or a list naming several
 *    versions — the version the row reports when asked.
 * 2. An `expected` that cannot be read is `404 RESOURCE_NOT_FOUND`: there is no record to predicate on.
 * 3. `next` is `expected + 1`, and the write is ONE statement predicated on `expected`, so nothing is
 *    decided between the comparison and the write.
 * 4. The affected-row count is the whole answer; a result carrying only the written row counts as one.
 * 5. Zero affected rows is explained by a read-back: a record that is gone is `404`, one that is still
 *    there is `409 ENTITY_VERSION_CONFLICT`.
 *
 * **The double decides rather than succeeds.** A suite that leans on it exercises the same three
 * outcomes the kernel produces, so a write that should have been refused is refused here too.
 */
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { STATUS_CODES } from 'http';

/** The code a refused write carries when the record it named is gone. */
export const RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND';

/** The code a refused write carries when the record moved past the version the caller accepted. */
export const ENTITY_VERSION_CONFLICT = 'ENTITY_VERSION_CONFLICT';

/** The subset of the kernel's error catalogue these suites branch on. */
export const ApiErrorCode = {
	RESOURCE_NOT_FOUND,
	ENTITY_VERSION_CONFLICT
};

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
 * carries the same three-key body Nest produces for every other `HttpException` and the same readable
 * `code` property, so the caller under test branches on the same value it branches on in production.
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
 * Writes a record under the version the caller read, or refuses.
 *
 * @param service The record's storage surface.
 * @param options The record, what the caller accepted and what to write.
 * @returns The version the record now holds.
 * @throws VersionedWriteException with `ENTITY_VERSION_CONFLICT` when the version moved on, or with
 * `RESOURCE_NOT_FOUND` when the record is gone.
 */
export async function commitVersionedUpdate(
	service: IVersionedWriterService,
	options: IVersionedWriteOptions
): Promise<{ version: number }> {
	const readCurrent = options.readVersion ?? (() => readStoredVersion(service, options.id));
	const expected = await resolveExpectedVersion(options.expectation, readCurrent);

	if (expected === null) {
		throw new VersionedWriteException(HttpStatus.NOT_FOUND, RESOURCE_NOT_FOUND, 'The requested record was not found.', {
			id: options.id
		});
	}

	const nextVersion = bumpVersion(expected);
	// The caller's criteria go in first and the two reserved columns last, exactly as the kernel orders
	// them: a `where` that carried an id or a version must not be able to replace the precondition.
	const criteria: Record<string, unknown> = {
		...(options.where ?? {}),
		id: options.id,
		version: expected
	};

	const result = await service.update(criteria, { ...options.patch, version: nextVersion });

	if (readAffected(result) > 0) {
		return { version: nextVersion };
	}

	const state = await readRowState(service, options.id);

	if (state.exists === false) {
		throw new VersionedWriteException(HttpStatus.NOT_FOUND, RESOURCE_NOT_FOUND, 'The requested record was not found.', {
			id: options.id
		});
	}

	throw new VersionedWriteException(
		HttpStatus.CONFLICT,
		ENTITY_VERSION_CONFLICT,
		'The record changed since you read it. Read it again and reapply your change.',
		{
			expectedVersion: expected,
			...(state.actualVersion === undefined || state.actualVersion === null
				? {}
				: { actualVersion: state.actualVersion })
		}
	);
}

/**
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
 * @param current The version read from the record.
 * @returns The next version. A record whose version is absent or unusable is treated as being at zero.
 */
function bumpVersion(current?: number | null): number {
	const base = typeof current === 'number' && Number.isInteger(current) && current > 0 ? current : 0;

	return base + 1;
}

/**
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
 * @param result What the update returned.
 * @returns The affected-row count, in whichever of the driver shapes it arrived.
 */
function readAffected(result: unknown): number {
	const candidate = result as { affected?: unknown; id?: unknown } | null | undefined;

	if (typeof candidate?.affected === 'number') {
		return candidate.affected;
	}

	return candidate?.id ? 1 : 0;
}

/**
 * @param service The record's storage surface.
 * @param id The record id.
 * @returns The version, or null when the record is gone or carries none.
 */
async function readStoredVersion(service: IVersionedWriterService, id: unknown): Promise<number | null> {
	const state = await readRowState(service, id);

	return state.exists === false ? null : (state.actualVersion ?? null);
}

/**
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

		// The read-back is diagnostic: it explains a conflict and tells a deleted record from one that
		// moved. Failing because the explanation could not be produced would report a conflict as a
		// server error, so the conflict stands without it.
		return {};
	}
}
