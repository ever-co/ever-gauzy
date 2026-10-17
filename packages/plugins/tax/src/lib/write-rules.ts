import { BadRequestException } from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID } from '@gauzy/contracts';

/**
 * Write rules of the tax package that the REST DTOs state and the GraphQL inputs cannot (R2-G34).
 *
 * A REST body is validated by its DTO (`@Min(0)`, `@Length(2, 2)`); a GraphQL input is an SDL type,
 * which states `Int` and `String` and nothing narrower, so the same write was refused over one protocol
 * and stored over the other. The rules are stated here, where both protocols reach the service, and the
 * REST DTOs keep refusing first exactly as before.
 */

/**
 * @param priority The priority a write states.
 * @param what The row being written, named in the error.
 * @throws BadRequestException when it is not a whole number of zero or more.
 */
export function assertPriority(priority: unknown, what: string): void {
	if (priority === undefined || priority === null) {
		return;
	}

	if (!Number.isInteger(Number(priority)) || Number(priority) < 0) {
		throw new BadRequestException(`The priority of ${what} is a whole number of zero or more; ${priority} is not.`);
	}
}

/**
 * @param countryCode The country a write states.
 * @param what The row being written, named in the error.
 * @throws BadRequestException when it is not a two-letter code.
 */
export function assertCountryCode(countryCode: unknown, what: string): void {
	if (countryCode === undefined || countryCode === null) {
		return;
	}

	// The string as written, exactly as `@Length(2, 2)` reads it: an empty or space-padded value is
	// refused rather than stored and then read as "no country restriction" by the zone match.
	if (typeof countryCode !== 'string' || countryCode.length !== 2 || countryCode.trim().length !== 2) {
		throw new BadRequestException(
			`The country of ${what} is a two-letter ISO 3166-1 code; "${String(countryCode)}" is not.`
		);
	}
}

/**
 * @param payload A write's payload.
 * @returns Every organization the payload states, through the `organizationId` column or through the
 * `organization` relation (which the ORM writes just as well); `null` for a member that clears it.
 */
export function statedOrganizations(payload: object | null | undefined): Array<ID | null> {
	const fields = (payload ?? {}) as Record<string, unknown>;
	const stated: Array<ID | null> = [];

	if (fields['organizationId'] !== undefined) {
		stated.push((fields['organizationId'] as ID) ?? null);
	}

	if (fields['organization'] !== undefined) {
		const relation = fields['organization'] as { id?: ID } | null;
		stated.push(relation?.id ?? null);
	}

	return stated;
}

/**
 * Refuses an update that would move a row out of the organization it belongs to.
 *
 * The REST update DTOs inherit `organizationId` from the tenant/organization base DTO, and the payload
 * reached the write as it came, so a `PUT` could re-home a row in another organization of the tenant.
 * Restating the row's own organization is accepted; a row stored without one may be given the caller's.
 *
 * @param payload The update's payload.
 * @param stored The organization the row belongs to.
 * @param caller The caller's organization.
 * @param what The row being written, named in the error.
 * @throws BadRequestException `TAX_ORGANIZATION_IMMUTABLE`.
 */
export function assertOrganizationUnchanged(
	payload: object | null | undefined,
	stored: ID | null | undefined,
	caller: ID | null | undefined,
	what: string
): void {
	const target = stored ?? caller;

	for (const stated of statedOrganizations(payload)) {
		if (!target || String(stated ?? '') !== String(target)) {
			throw new BadRequestException(
				`TAX_ORGANIZATION_IMMUTABLE: ${what} stays in the organization it was created in.`
			);
		}
	}
}

/**
 * The answer of a retirement: the number of rows the statement actually retired.
 *
 * The services answered `{ affected: 1 }` whatever the statement did, so a criteria that retired several
 * rows reported one. TypeORM states the count; an ORM that answers with the row instead retired that one.
 *
 * @param result What the soft delete answered.
 * @returns The platform's delete result shape.
 */
export function retirementResult(result: unknown): DeleteResult {
	const affected = (result as UpdateResult | undefined)?.affected;

	return { affected: typeof affected === 'number' ? affected : 1, raw: [] } as DeleteResult;
}
