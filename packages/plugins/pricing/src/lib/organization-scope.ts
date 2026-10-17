import { BadRequestException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';

/**
 * The organization a pricing row belongs to, decided once for both protocols.
 *
 * Every pricing read is scoped to the caller's organization, so a row is only ever useful inside it.
 * Two writes did not hold to that (R2-G31, R2-G34):
 *
 * - **A create stated no organization over GraphQL.** The GraphQL inputs of a price preference and an
 *   exchange rate carry no `organizationId`, the services wrote what the payload stated, and the row was
 *   stored with `organizationId = NULL` — where no organization-scoped lookup ever reads it.
 * - **An update could move a row into another organization.** The REST update DTOs inherit
 *   `organizationId` from the tenant/organization base DTO, and the payload reached the write as it came.
 *
 * Both are answered here, so the REST route and the GraphQL field cannot disagree about either.
 */

/**
 * @param stated The organization the payload states, when it states one.
 * @param caller The caller's organization.
 * @param what The row being written, named in the error.
 * @returns The organization the row is written into: the caller's.
 * @throws BadRequestException `PRICE_ORGANIZATION_MISMATCH` when the payload states another organization,
 * and `PRICE_ORGANIZATION_REQUIRED` when there is none at all.
 */
export function organizationForCreate(stated: unknown, caller: ID | null | undefined, what: string): ID {
	if (stated && caller && String(stated) !== String(caller)) {
		throw new BadRequestException(`PRICE_ORGANIZATION_MISMATCH: ${what} belongs to the caller's organization.`);
	}

	const organizationId = (caller ?? stated) as ID | undefined;

	if (!organizationId) {
		throw new BadRequestException(`PRICE_ORGANIZATION_REQUIRED: ${what} is written inside an organization.`);
	}

	return organizationId;
}

/**
 * Refuses an update that would move a row out of the organization it belongs to.
 *
 * Restating the row's own organization is accepted, so a client that echoes the row back keeps working.
 * A row stored without one — the defect above — may be given the caller's, which is how it is repaired.
 *
 * @param stated The organization the payload states; `undefined` when it states none.
 * @param stored The organization the row belongs to.
 * @param caller The caller's organization.
 * @param what The row being written, named in the error.
 * @throws BadRequestException `PRICE_ORGANIZATION_IMMUTABLE`.
 */
export function assertOrganizationUnchanged(
	stated: unknown,
	stored: ID | null | undefined,
	caller: ID | null | undefined,
	what: string
): void {
	if (stated === undefined) {
		return;
	}

	const target = stored ?? caller;

	if (!target || String(stated ?? '') !== String(target)) {
		throw new BadRequestException(
			`PRICE_ORGANIZATION_IMMUTABLE: ${what} stays in the organization it was created in; ` +
				'create it again inside the other organization instead.'
		);
	}
}
