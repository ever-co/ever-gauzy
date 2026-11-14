/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `user.email-lookup.spec.ts` for the cycle it avoids).
 */
import '../core/entities/internal';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { hideOrganization, restoreOrganization } from './organization-deletion';
import { OrganizationService } from './organization.service';

jest.mock('./organization-deletion', () => ({
	...jest.requireActual('./organization-deletion'),
	hideOrganization: jest.fn(),
	restoreOrganization: jest.fn()
}));

/**
 * The organization's delete routes (ever-co/ever-gauzy#11960): the soft delete and the restore go through the
 * organization's own deletion in one transaction.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'org-1';

describe('OrganizationService — deleting an organization (#11960)', () => {
	const manager = { name: 'transaction manager' };
	let service: OrganizationService;
	let findOneByIdString: jest.Mock;
	let transaction: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		findOneByIdString = jest.fn().mockResolvedValue({ id: ORGANIZATION, tenantId: TENANT, deletedAt: null });
		transaction = jest.fn((work: (manager: unknown) => Promise<unknown>) => work(manager));
		service = Object.create(OrganizationService.prototype) as OrganizationService;
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager: { transaction } } });
		Object.defineProperty(service, 'findOneByIdString', { value: findOneByIdString });
		(hideOrganization as jest.Mock).mockResolvedValue({});
		(restoreOrganization as jest.Mock).mockResolvedValue({});
	});

	afterEach(() => jest.restoreAllMocks());

	describe('softRemove', () => {
		it('hides the organization of the caller’s tenant in one transaction, and answers it deleted', async () => {
			const removed = await service.softRemove(ORGANIZATION);

			expect(findOneByIdString).toHaveBeenCalledWith(ORGANIZATION);
			expect(transaction).toHaveBeenCalledTimes(1);
			expect(hideOrganization).toHaveBeenCalledWith(
				manager,
				{ id: ORGANIZATION, tenantId: TENANT },
				expect.any(Date)
			);
			const [, , deletedAt] = (hideOrganization as jest.Mock).mock.calls[0];
			expect(removed.deletedAt).toBe(deletedAt);
		});

		it('lets the refusal of the last organization through, instead of a 404', async () => {
			const refusal = new ConflictException({ code: 'ORGANIZATION_LAST_OF_WORKSPACE' });
			(hideOrganization as jest.Mock).mockRejectedValue(refusal);

			await expect(service.softRemove(ORGANIZATION)).rejects.toBe(refusal);
		});

		it('answers 404 for an organization the caller’s tenant does not have, and hides nothing', async () => {
			findOneByIdString.mockRejectedValue(new NotFoundException());

			await expect(service.softRemove(ORGANIZATION)).rejects.toBeInstanceOf(NotFoundException);
			expect(hideOrganization).not.toHaveBeenCalled();
		});
	});

	describe('softRecover', () => {
		it('reads the organization with deleted rows, restores it in one transaction, and answers it restored', async () => {
			findOneByIdString.mockResolvedValue({ id: ORGANIZATION, tenantId: TENANT, deletedAt: new Date() });

			const recovered = await service.softRecover(ORGANIZATION);

			expect(findOneByIdString).toHaveBeenCalledWith(ORGANIZATION, { withDeleted: true });
			expect(restoreOrganization).toHaveBeenCalledWith(manager, { id: ORGANIZATION, tenantId: TENANT });
			expect(recovered.deletedAt).toBeNull();
		});
	});
});
