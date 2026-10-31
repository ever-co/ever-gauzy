import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseEntityEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { CommentParentAccessPolicy } from './comment-parent-access-policy.decorator';
import { CommentParentAccessService } from './comment-parent-access.service';
import { ICommentParent, ICommentParentAccessPolicy } from './comment-parent-access.types';

const CONTACT_ID = '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f';

@CommentParentAccessPolicy()
@Injectable()
class ContactPolicy implements ICommentParentAccessPolicy {
	readonly entity = BaseEntityEnum.OrganizationContact;
	readonly readPermissions = [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW];
	readonly writePermissions = [PermissionsEnum.ORG_CONTACT_EDIT];
	findAccessibleParent = jest.fn(async (id: string): Promise<ICommentParent | null> =>
		id === CONTACT_ID ? { id, organizationId: 'org-1' } : null
	);
}

@Injectable()
class UnmarkedProvider {
	readonly entity = BaseEntityEnum.OrganizationProject;
}

const holding = (...permissions: PermissionsEnum[]) =>
	jest
		.spyOn(RequestContext, 'hasAnyPermission')
		.mockImplementation((wanted: PermissionsEnum[]) =>
			wanted.some((permission) => permissions.includes(permission))
		);

describe('CommentParentAccessService', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('discovery', () => {
		it('registers the providers marked as policies, and only those', () => {
			const policy = new ContactPolicy();
			const discovery = {
				getProviders: () => [
					{ instance: policy, metatype: ContactPolicy },
					{ instance: new UnmarkedProvider(), metatype: UnmarkedProvider },
					// A provider not instantiated yet (request scoped) is skipped.
					{ instance: undefined, metatype: ContactPolicy }
				]
			};
			const service = new CommentParentAccessService(discovery as any, new Reflector());

			service.onModuleInit();

			expect(service.governedEntities()).toEqual([BaseEntityEnum.OrganizationContact]);
			expect(service.isGoverned(BaseEntityEnum.OrganizationContact)).toBe(true);
			expect(service.isGoverned(BaseEntityEnum.OrganizationProject)).toBe(false);
			expect(service.isGoverned(undefined)).toBe(false);
		});

		it('governs nothing without discovery, so the comment API keeps its own rules', () => {
			const service = new CommentParentAccessService();

			service.onModuleInit();

			expect(service.governedEntities()).toEqual([]);
		});

		it('refuses a second policy class for the same record type, and keeps one class listed twice', () => {
			const service = new CommentParentAccessService();
			service.register(new ContactPolicy());

			expect(() => service.register(new ContactPolicy())).not.toThrow();
			expect(() =>
				service.register({
					entity: BaseEntityEnum.OrganizationContact,
					readPermissions: [],
					writePermissions: [],
					findAccessibleParent: async () => null
				})
			).toThrow(/already registered/);
		});
	});

	describe('assertMay', () => {
		let service: CommentParentAccessService;
		let policy: ContactPolicy;

		beforeEach(() => {
			service = new CommentParentAccessService();
			policy = new ContactPolicy();
			service.register(policy);
		});

		it('answers null for a record type without a policy, checking nothing', async () => {
			const hasAny = holding();

			await expect(
				service.assertMay('write', BaseEntityEnum.OrganizationProject, 'anything')
			).resolves.toBeNull();
			expect(hasAny).not.toHaveBeenCalled();
			expect(policy.findAccessibleParent).not.toHaveBeenCalled();
		});

		it('answers the record to a caller holding any one of the read permissions', async () => {
			holding(PermissionsEnum.ALL_ORG_VIEW);

			await expect(service.assertMay('read', BaseEntityEnum.OrganizationContact, CONTACT_ID)).resolves.toEqual({
				id: CONTACT_ID,
				organizationId: 'org-1'
			});
		});

		it('refuses with 403 a caller without the permission, before reading the record', async () => {
			holding(PermissionsEnum.ORG_CONTACT_VIEW);

			await expect(
				service.assertMay('write', BaseEntityEnum.OrganizationContact, CONTACT_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(policy.findAccessibleParent).not.toHaveBeenCalled();
		});

		it('answers 404 for a record the caller cannot reach, as for a missing one', async () => {
			holding(PermissionsEnum.ORG_CONTACT_EDIT);

			await expect(
				service.assertMay('write', BaseEntityEnum.OrganizationContact, '0f1e2d3c-4b5a-4968-8776-655443322110')
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it.each([undefined, null, '', 'not-a-uuid', 42])(
			'answers 404 for a record id %p, without a lookup',
			async (id) => {
				holding(PermissionsEnum.ORG_CONTACT_EDIT);

				await expect(service.assertMay('write', BaseEntityEnum.OrganizationContact, id)).rejects.toBeInstanceOf(
					NotFoundException
				);
				expect(policy.findAccessibleParent).not.toHaveBeenCalled();
			}
		);
	});
});
