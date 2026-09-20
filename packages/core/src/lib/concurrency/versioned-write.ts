import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { ID } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { BaseEntity } from '../core/entities/base.entity';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	IVersionExpectation,
	VERSION_EXPECTATION_PROPERTY,
	bumpVersion,
	evaluateVersionedWrite,
	parseEntityVersion,
	resolveExpectedVersion
} from './version.util';

/** What a conditional write is told to do. */
export interface IVersionedWriteOptions<T> {
	/** The record's id. */
	id: ID;
	/** What the caller accepted in its `If-Match` header. */
	expectation: IVersionExpectation;
	/** The columns to write. `version` is set by this helper and must not be part of the patch. */
	patch: Record<string, unknown> & Partial<T>;
	/** Extra criteria the row must satisfy, for example the tenant and organization scope. */
	where?: Record<string, unknown>;
	/** A reader for the row's version, for a caller that has the row in hand already. */
	readVersion?: () => Promise<number | null>;
}

/**
 * The version this request must be predicated on.
 *
 * The guard leaves what the caller accepted on the request; the write reads it from there rather
 * than parsing the header again, so the value the guard validated is the value the UPDATE is
 * predicated on. A write that reaches here without one is refused rather than run unconditionally —
 * an opt-in that silently degrades to last-write-wins is worse than no opt-in at all, because the
 * caller believes it is protected.
 *
 * @param request The request the guard ran on.
 * @returns What the caller accepted.
 * @throws ApiException when the request states no version.
 */
export function versionExpectationOf(request: any): IVersionExpectation {
	const expectation = request?.[VERSION_EXPECTATION_PROPERTY];

	if (!expectation) {
		throw new ApiException(
			HttpStatus.PRECONDITION_REQUIRED,
			ApiErrorCode.VERSION_REQUIRED,
			'This write must state the version it was based on, and no version was accepted for it.'
		);
	}

	return expectation as IVersionExpectation;
}

/**
 * Writes a record under the version the caller read, or refuses.
 *
 * The comparison and the write are one statement — `UPDATE … SET version = :next … WHERE id = :id
 * AND version = :expected` — so there is no window between deciding and acting, and no read-then-write
 * race to lose. The affected-row count is the whole answer: one row means the write landed and the
 * record is now at the next version; zero means the record moved on, or was deleted, between the
 * caller's read and this statement.
 *
 * Both ORMs go through the same `CrudService.update`, which is the platform's dual-ORM update path:
 * TypeORM's `Repository.update` and MikroORM's `nativeUpdate` both accept an ordinary scalar
 * criteria object and both report how many rows they changed, so the caller above this never learns
 * which ORM it ran on. An entity with no `version` column never reaches this helper — nothing calls
 * it on a route that did not opt in — and therefore behaves exactly as it does today.
 *
 * @param service The service that owns the record.
 * @param options The record, what the caller accepted and what to write.
 * @returns The version the record now holds.
 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the version moved on, or with
 * `RESOURCE_NOT_FOUND` when the record is gone.
 */
export async function commitVersionedUpdate<T extends BaseEntity>(
	service: CrudService<T>,
	options: IVersionedWriteOptions<T>
): Promise<{ version: number }> {
	const readCurrent = options.readVersion ?? (() => readStoredVersion(service, options.id));
	const expected = await resolveExpectedVersion(options.expectation, readCurrent);

	if (expected === null) {
		throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCode.RESOURCE_NOT_FOUND, 'The requested record was not found.', {
			id: options.id
		});
	}

	const nextVersion = bumpVersion(expected);
	// The caller's extra criteria go in FIRST and the two reserved columns go in last, because the
	// spread order is the whole guarantee. `where` is documented as the tenant and organization scope,
	// and every call site builds it by spreading a criteria object — so a `where` that already carried
	// an `id` or a `version` would, written the other way round, silently replace the precondition and
	// predicated the statement on a version this helper never validated. Reserving both columns makes
	// that impossible rather than merely unlikely: a caller cannot state a precondition this function
	// did not derive.
	const criteria: Record<string, unknown> = {
		...(options.where ?? {}),
		id: options.id,
		version: expected
	};

	// The patch is typed loosely on purpose: `version` is a convention an entity opts into with
	// `@VersionedColumn()`, not a member of the base entity, so it cannot be expressed in
	// `Partial<T>` for every T. The criteria and the increment are the load-bearing parts.
	const result = await service.update(criteria as any, { ...options.patch, version: nextVersion } as any);
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
		throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCode.RESOURCE_NOT_FOUND, 'The requested record was not found.', {
			id: options.id
		});
	}

	throw new ApiException(
		HttpStatus.CONFLICT,
		ApiErrorCode.ENTITY_VERSION_CONFLICT,
		'The record changed since you read it. Read it again and reapply your change.',
		{
			expectedVersion: outcome.expectedVersion,
			...(outcome.actualVersion === undefined ? {} : { actualVersion: outcome.actualVersion })
		}
	);
}

/**
 * How many rows an update changed, whichever ORM answered.
 *
 * TypeORM reports an `UpdateResult`; the MikroORM path of `CrudService.update` reports the same
 * shape with the affected count in it. An ORM that answers with the updated row instead is
 * understood too, so a change in either driver does not silently read as "matched nothing" — which
 * would turn every write into a false conflict.
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
 * **A read that failed is not a record that is absent, and this is the one place the difference is
 * load-bearing.** The version this answers is what the `UPDATE` is predicated on, so swallowing a
 * transient failure here would turn "the store did not answer" into "the record is not there" — and
 * the caller would be sent down the deleted-record path, told to stop retrying, for a row that is
 * still there. The failure is therefore raised. The read-back *after* a failed update is the opposite
 * case and is caught deliberately: there the value only explains a conflict that has already been
 * decided, and failing the request over an explanation would report a conflict as a server error.
 *
 * @param service The service that owns the record.
 * @param id The record id.
 * @returns The version, or null when the record is gone or carries none.
 * @throws Whatever the reader raised, when it raised something other than a miss.
 */
async function readStoredVersion<T extends BaseEntity>(service: CrudService<T>, id: ID): Promise<number | null> {
	try {
		const row = await service.findOneByIdString(id);

		return parseEntityVersion((row as any)?.['version']);
	} catch (error) {
		if (error instanceof NotFoundException) {
			return null;
		}

		throw error;
	}
}

/**
 * Reads what a record currently looks like.
 *
 * @param service The service that owns the record.
 * @param id The record id.
 * @returns Its version and whether it exists, as far as that could be determined.
 */
async function readRowState<T extends BaseEntity>(
	service: CrudService<T>,
	id: ID
): Promise<{ actualVersion?: number | null; exists?: boolean }> {
	try {
		const row = await service.findOneByIdString(id);

		return { actualVersion: parseEntityVersion((row as any)?.['version']), exists: !!row };
	} catch (error) {
		if (error instanceof NotFoundException) {
			return { exists: false };
		}

		// The read-back is diagnostic: it explains a conflict and distinguishes a deleted row from a
		// moved one. Failing the request because the explanation could not be produced would report a
		// conflict as a server error, so the conflict stands without it.
		return {};
	}
}
