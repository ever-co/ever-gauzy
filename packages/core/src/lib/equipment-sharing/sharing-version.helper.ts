import { HttpStatus } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { parseEntityVersion } from '../concurrency/version.util';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';

/**
 * The version an edit of an equipment sharing is a compare-and-set on.
 *
 * The body may state the version its author read; that is the one the write is predicated on, so an edit made on a
 * copy that has since moved on is refused instead of overwriting what moved it. A body that states none — every client
 * written before the column existed — is predicated on the version the server read, which still separates two writers
 * whose reads precede both writes. A stored row without a version (none should exist once the column is migrated)
 * answers `null`, and the write is made without a precondition, as before.
 *
 * Free of entity imports so it can be unit-tested on plain values.
 *
 * @param stated The `version` member of the body, as it arrived.
 * @param stored The version of the row the server read.
 * @returns The version to predicate the write on, or `null` for none.
 * @throws ApiException 400 `VALIDATION_FAILED` when the body states something that is not a version.
 */
export function expectedSharingVersion(stated: unknown, stored: unknown): number | null {
	if (stated !== undefined && stated !== null && stated !== '') {
		const version = parseEntityVersion(stated);
		if (version === null) {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.VALIDATION_FAILED,
				'The version of an equipment sharing is a positive integer.',
				{ field: 'version' }
			);
		}
		return version;
	}
	return parseEntityVersion(stored);
}

/**
 * The version an in-place edit of an equipment sharing is a compare-and-set on: the one the body states, which is
 * required. Unlike the edit that removes and files the row again ({@link expectedSharingVersion}), the in-place edit
 * has no fallback to the version the server reads: the version is how the caller says which state of the row the
 * edit is based on, and a write predicated on the server's own read would only separate two writers whose reads both
 * precede both writes.
 *
 * @param stated The `version` member of the body, as it arrived.
 * @returns The version to predicate the write on.
 * @throws ApiException 400 `VALIDATION_FAILED` when the body states no version, or something that is not one.
 */
export function requiredSharingVersion(stated: unknown): number {
	const version = stated === undefined || stated === null || stated === '' ? null : parseEntityVersion(stated);
	if (version === null) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.VALIDATION_FAILED,
			'The in-place edit of an equipment sharing states the version it is based on, a positive integer.',
			{ field: 'version' }
		);
	}
	return version;
}

/**
 * The refusal of an edit whose precondition matched no row: the sharing moved on, or was replaced or removed, after
 * the version the edit is based on was read.
 *
 * A row that is gone is answered as the same conflict rather than as a 404: it was there when the edit read it, and
 * the edit of a sharing is a delete-then-recreate, so a row missing for a moment is one another edit is replacing.
 *
 * @param id The sharing.
 * @param expectedVersion The version the edit was predicated on, if any.
 * @param actualVersion The version the row holds now, when it is there.
 */
export function sharingVersionConflict(
	id: ID,
	expectedVersion: number | null,
	actualVersion?: number | null
): ApiException {
	return new ApiException(
		HttpStatus.CONFLICT,
		ApiErrorCode.ENTITY_VERSION_CONFLICT,
		'The equipment sharing changed since you read it. Read it again and reapply your change.',
		{
			id,
			...(typeof expectedVersion === 'number' ? { expectedVersion } : {}),
			...(typeof actualVersion === 'number' ? { actualVersion } : {})
		}
	);
}

/**
 * How many rows a write changed, whichever ORM answered (TypeORM's `UpdateResult` / `DeleteResult`, or the
 * `{ affected }` the MikroORM arm of the CRUD base answers).
 *
 * @param result What the write returned.
 */
export function affectedRows(result: unknown): number {
	const affected = (result as { affected?: unknown } | null | undefined)?.affected;
	return typeof affected === 'number' ? affected : 0;
}
