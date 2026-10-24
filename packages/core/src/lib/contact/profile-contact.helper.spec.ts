import { IContact } from '@gauzy/contracts';
import { ownContactPatch } from './profile-contact.helper';

/**
 * A profile edit (`PUT /employee/:id/profile`, `PUT /employee/:id`, `PUT /candidate/:id`) writes the profile's own
 * contact and never another one (privilege-escalation audit 2026-10-24, F9). `contact` is a cascading owner
 * one-to-one, so a nested id used to re-point the profile at an organization's, a client's or a candidate's
 * contact and overwrite it.
 */
describe('ownContactPatch', () => {
	const OWN_CONTACT = 'contact-own';
	const CLIENT_CONTACT = 'contact-of-a-client';
	const owner = { contactId: OWN_CONTACT, tenantId: 'tenant-1', organizationId: 'organization-1' };

	it("drops an id that is not the profile's own contact, so another contact is never overwritten", () => {
		const patch = ownContactPatch(owner, { id: CLIENT_CONTACT, city: 'Sofia' } as IContact);

		expect(patch).toEqual({ city: 'Sofia', tenantId: 'tenant-1', organizationId: 'organization-1' });
	});

	it("keeps the profile's own contact id, which updates that row in place", () => {
		const patch = ownContactPatch(owner, { id: OWN_CONTACT, city: 'Sofia' } as IContact);

		expect(patch.id).toBe(OWN_CONTACT);
	});

	it("keeps the profile's own contact id in another case, as the stored id", () => {
		// PostgreSQL, and MySQL's default collation, compare UUIDs without regard to case.
		const patch = ownContactPatch(owner, { id: OWN_CONTACT.toUpperCase(), city: 'Sofia' } as IContact);

		expect(patch.id).toBe(OWN_CONTACT);
	});

	it('reads the stored links off the loaded relations when the id columns are empty, as under MikroORM', () => {
		// MikroORM's relation-id columns are `persist: false` mirrors, which a read leaves empty.
		const patch = ownContactPatch(
			{ contact: { id: OWN_CONTACT }, tenant: { id: 'tenant-1' }, organization: { id: 'organization-1' } },
			{ id: OWN_CONTACT, city: 'Sofia' } as IContact
		);

		expect(patch).toEqual({
			id: OWN_CONTACT,
			city: 'Sofia',
			tenantId: 'tenant-1',
			organizationId: 'organization-1'
		});
	});

	it('drops any id for a profile that has no contact yet, so the edit cascades a new row', () => {
		const patch = ownContactPatch(
			{ ...owner, contactId: null },
			{ id: CLIENT_CONTACT, city: 'Sofia' } as IContact
		);

		expect(patch).not.toHaveProperty('id');
		expect(patch.city).toBe('Sofia');
	});

	it('leaves an edit without an id as it was, which is what the profile location form sends', () => {
		const patch = ownContactPatch(owner, { country: 'BG', latitude: 42.7, longitude: 23.3 } as IContact);

		expect(patch).toEqual({
			country: 'BG',
			latitude: 42.7,
			longitude: 23.3,
			tenantId: 'tenant-1',
			organizationId: 'organization-1'
		});
	});

	it('copies only the postal, geographic and fiscal facts: never a column the server manages', () => {
		// `PUT /candidate/:id` does not whitelist its body, so these reached the cascading contact save.
		const patch = ownContactPatch(owner, {
			city: 'Sofia',
			createdAt: new Date('2020-01-01T00:00:00.000Z'),
			deletedAt: new Date('2020-01-01T00:00:00.000Z'),
			isActive: false,
			isArchived: true,
			createdByUserId: 'user-other'
		} as unknown as IContact);

		expect(patch).toEqual({ city: 'Sofia', tenantId: 'tenant-1', organizationId: 'organization-1' });
	});

	it("stamps the profile's tenant and organization over the body's, and drops the contact's other owners", () => {
		const patch = ownContactPatch(owner, {
			city: 'Sofia',
			tenantId: 'tenant-other',
			tenant: { id: 'tenant-other' },
			organizationId: 'organization-other',
			organization: { id: 'organization-other' },
			organizationContact: { id: 'client-1' },
			candidate: { id: 'candidate-1' },
			employee: { id: 'employee-other' }
		} as unknown as IContact);

		expect(patch).toEqual({ city: 'Sofia', tenantId: 'tenant-1', organizationId: 'organization-1' });
	});
});
