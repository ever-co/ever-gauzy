import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseEntityEnum, PermissionsEnum } from '@gauzy/contracts';
import { COMMENT_PARENT_ACCESS_POLICY } from '../comment/parent-access/comment-parent-access-policy.decorator';
import { OrganizationContactCommentAccessPolicy } from './organization-contact-comment-access.policy';

// The policy reads contacts through the service; loading the real one would pull in the whole entity graph.
jest.mock('./organization-contact.service', () => ({ OrganizationContactService: class {} }));

const CONTACT_ID = '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f';

describe('OrganizationContactCommentAccessPolicy: who may read and write a contact’s notes', () => {
	const policyWith = (findOneByIdString: jest.Mock) =>
		new OrganizationContactCommentAccessPolicy({ findOneByIdString } as any);

	it('is discovered as the policy of the contact’s comments', () => {
		const policy = policyWith(jest.fn());

		expect(new Reflector().get(COMMENT_PARENT_ACCESS_POLICY, OrganizationContactCommentAccessPolicy)).toBe(true);
		expect(policy.entity).toBe(BaseEntityEnum.OrganizationContact);
	});

	it('reads with ORG_CONTACT_VIEW and writes with ORG_CONTACT_EDIT', () => {
		const policy = policyWith(jest.fn());

		expect(policy.readPermissions).toEqual([PermissionsEnum.ORG_CONTACT_VIEW]);
		expect(policy.writePermissions).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
	});

	it('answers the contact the scoped contact read finds, with its organization', async () => {
		const find = jest.fn().mockResolvedValue({ id: CONTACT_ID, organizationId: 'org-1', name: 'Acme' });

		await expect(policyWith(find).findAccessibleParent(CONTACT_ID)).resolves.toEqual({
			id: CONTACT_ID,
			organizationId: 'org-1'
		});
		// The service's own tenant- and organization-scoped finder, with no option that widens it.
		expect(find).toHaveBeenCalledWith(CONTACT_ID);
	});

	it('answers a contact of the whole tenant with no organization', async () => {
		const find = jest.fn().mockResolvedValue({ id: CONTACT_ID, organizationId: null, name: 'Acme' });

		await expect(policyWith(find).findAccessibleParent(CONTACT_ID)).resolves.toEqual({
			id: CONTACT_ID,
			organizationId: null
		});
	});

	it('answers null for a contact the caller cannot reach', async () => {
		const find = jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found'));

		await expect(policyWith(find).findAccessibleParent(CONTACT_ID)).resolves.toBeNull();
	});

	it('lets any other failure through rather than reading it as a missing contact', async () => {
		const failure = new Error('connection lost');

		await expect(policyWith(jest.fn().mockRejectedValue(failure)).findAccessibleParent(CONTACT_ID)).rejects.toBe(
			failure
		);
	});
});
