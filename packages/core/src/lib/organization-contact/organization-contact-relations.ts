import { BadRequestException } from '@nestjs/common';

/**
 * The relations `GET /organization-contact?data={"findInput":{"employeeId":...}}` may load.
 *
 * That branch (`OrganizationContactService.getOrganizationContactByEmployee`) builds its own joins, so
 * it never reaches the sensitive-relation check `CrudService` runs on its read methods. Joining a
 * client-supplied string verbatim let any tenant member walk `organization.payments`,
 * `organization.invoices`, `invoices`, `payments` and friends (GHSA-c3cj-m3xm-7j5h). Only the direct,
 * non-financial relations of a contact are allowed; no web, desktop or plugin client requests anything
 * else on this branch.
 */
export const ORGANIZATION_CONTACT_EMPLOYEE_RELATIONS: ReadonlyArray<string> = Object.freeze([
	'members',
	'tags',
	'projects',
	'contact',
	'image'
]);

/**
 * Normalizes the client `relations` of the employee branch and rejects anything outside
 * {@link ORGANIZATION_CONTACT_EMPLOYEE_RELATIONS}.
 *
 * @param relations - The raw `relations` value from the `data` query parameter (array, comma-separated
 *                    string, or absent).
 * @returns The de-duplicated list of allowed relation names.
 * @throws BadRequestException when a relation is not a string or not allowlisted.
 */
export function resolveOrganizationContactEmployeeRelations(relations: unknown): string[] {
	if (relations === undefined || relations === null || relations === '') {
		return [];
	}

	const list: unknown = typeof relations === 'string' ? relations.split(',') : relations;
	if (!Array.isArray(list)) {
		throw new BadRequestException('relations must be an array of relation names.');
	}

	const resolved = new Set<string>();
	for (const relation of list) {
		const name = typeof relation === 'string' ? relation.trim() : relation;
		if (typeof name !== 'string' || !ORGANIZATION_CONTACT_EMPLOYEE_RELATIONS.includes(name)) {
			throw new BadRequestException(
				`Relation '${String(relation)}' cannot be loaded here. Allowed relations: ${ORGANIZATION_CONTACT_EMPLOYEE_RELATIONS.join(', ')}.`
			);
		}
		resolved.add(name);
	}
	return [...resolved];
}
