import { BadRequestException, NotFoundException } from '@nestjs/common';
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
 * Both are answered here, so the REST route and the GraphQL field cannot disagree about either. A payload
 * states its organization in two ways — the `organizationId` column and the `organization` relation, which
 * the ORM writes just as well — and both are read.
 */

/**
 * @param payload A write's payload.
 * @returns Every organization the payload states, through the column or through the relation; `null`
 * for a member that clears it. Empty when it states none.
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
 * @param payload The create's payload.
 * @param caller The caller's organization.
 * @param what The row being written, named in the error.
 * @returns The organization the row is written into: the caller's.
 * @throws BadRequestException `PRICE_ORGANIZATION_MISMATCH` when the payload states another organization,
 * and `PRICE_ORGANIZATION_REQUIRED` when there is none at all.
 */
export function organizationForCreate(
	payload: object | null | undefined,
	caller: ID | null | undefined,
	what: string
): ID {
	const stated = statedOrganizations(payload).filter((organizationId): organizationId is ID => !!organizationId);

	if (caller && stated.some((organizationId) => String(organizationId) !== String(caller))) {
		throw new BadRequestException(`PRICE_ORGANIZATION_MISMATCH: ${what} belongs to the caller's organization.`);
	}

	if (!caller && new Set(stated.map(String)).size > 1) {
		throw new BadRequestException(`PRICE_ORGANIZATION_MISMATCH: ${what} states two organizations.`);
	}

	const organizationId = caller ?? stated[0];

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
 * @param payload The update's payload.
 * @param stored The organization the row belongs to.
 * @param caller The caller's organization.
 * @param what The row being written, named in the error.
 * @throws BadRequestException `PRICE_ORGANIZATION_IMMUTABLE`.
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
				`PRICE_ORGANIZATION_IMMUTABLE: ${what} stays in the organization it was created in; ` +
					'create it again inside the other organization instead.'
			);
		}
	}
}

/**
 * Answers a row of another organization than the caller's as a miss.
 *
 * The read by id every pricing service inherits (`TenantAwareCrudService.findOneByIdString`) is narrowed to the
 * caller's tenant only, and every route that reads or writes one row by id resolves it through that read first: the
 * inherited `GET /:id`, the updates, the deletes, the withdraw/restore pair and a price list's activation, expiry and
 * simulation, on REST and GraphQL alike. A caller of one organization could therefore read and rewrite a price, a
 * price list, an exchange rate or a price preference of a sibling organization of the tenant by naming its id.
 *
 * A row stored without an organization (R2-G31) stays reachable, so an update can still repair it, and a read with no
 * organization in context (a job) is not narrowed.
 *
 * @param row The row the inherited read found.
 * @param caller The caller's organization.
 * @returns The row.
 * @throws NotFoundException the inherited read's own miss, when the row belongs to another organization.
 */
export function inCallerOrganization<T extends { organizationId?: ID | null }>(
	row: T,
	caller: ID | null | undefined
): T {
	if (caller && row?.organizationId && String(row.organizationId) !== String(caller)) {
		throw new NotFoundException('The requested record was not found');
	}

	return row;
}
