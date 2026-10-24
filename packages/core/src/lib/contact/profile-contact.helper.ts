import { IContact, ID } from '@gauzy/contracts';

/** The contact members a profile edit never states: the row's scope and its other owners. */
const NOT_THE_EDITS_TO_STATE: ReadonlyArray<string> = Object.freeze([
	'tenantId',
	'tenant',
	'organizationId',
	'organization',
	'employee',
	'employeeId',
	'candidate',
	'candidateId',
	'organizationContact',
	'organizationContactId'
]);

/** The profile a contact belongs to: an employee or a candidate, as stored. */
export interface IProfileContactOwner {
	contactId?: ID | null;
	contact?: { id?: ID | null } | null;
	tenantId?: ID | null;
	tenant?: { id?: ID | null } | null;
	organizationId?: ID | null;
	organization?: { id?: ID | null } | null;
}

/**
 * A link the profile stores: its relation-id column, or else the id of the relation the read loaded. Under MikroORM
 * the column is a `persist: false` mirror of the relation, which a read leaves empty, so the relation is loaded.
 */
function storedLink(column: ID | null | undefined, relation: { id?: ID | null } | null | undefined): ID | undefined {
	return column ?? relation?.id ?? undefined;
}

/**
 * The contact a profile edit writes: the profile's own contact, and never another one.
 *
 * `Employee.contact` and `Candidate.contact` are cascading owner one-to-ones. A nested `id` in the edit
 * re-pointed the profile at that contact and overwrote it in place. A same-tenant row passes the nested-graph
 * ownership check, so this reached the contacts of organizations, clients (organization contacts) and
 * candidates. The unique `contactId` only stopped another employee's contact from being taken.
 *
 * So:
 * - an `id` is kept only when it is the profile's stored contact (the profile's own row, updated in place),
 *   compared without regard to case as the database compares UUIDs, and the stored id is the one kept. Any other
 *   `id` is dropped;
 * - an edit without an `id` cascades a contact row exactly as before. That is what the profile location
 *   form sends;
 * - the contact carries the profile's tenant and organization, not the body's, and no other owner.
 *
 * @param owner - The profile as stored: its contact, tenant and organization, as columns or loaded relations.
 * @param contact - The contact members the edit sent.
 * @returns The contact to cascade.
 */
export function ownContactPatch(owner: IProfileContactOwner, contact: IContact): IContact {
	const facts = { ...((contact ?? {}) as Record<string, unknown>) };
	for (const member of NOT_THE_EDITS_TO_STATE) {
		delete facts[member];
	}

	const ownId = storedLink(owner?.contactId, owner?.contact);
	if ('id' in facts) {
		const stated = facts['id'];
		if (ownId && typeof stated === 'string' && stated.toLowerCase() === String(ownId).toLowerCase()) {
			facts['id'] = ownId;
		} else {
			delete facts['id'];
		}
	}

	return {
		...facts,
		tenantId: storedLink(owner?.tenantId, owner?.tenant),
		organizationId: storedLink(owner?.organizationId, owner?.organization)
	} as IContact;
}
