jest.mock('@gauzy/config', () => ({
	environment: {
		demo: false,
		clientBaseUrl: 'https://app.gauzy.co',
		appIntegrationConfig: { appName: 'Gauzy', appLink: 'https://app.gauzy.co' }
	}
}));
jest.mock('../core/entities/internal', () => ({
	ImageAsset: class ImageAsset {},
	Screenshot: class Screenshot {},
	Tenant: class Tenant {},
	User: class User {},
	UserOrganization: class {}
}));
jest.mock('../core/file-storage', () => ({ FileStorage: class {} }));
jest.mock('../email-send/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../auth/strategies/authenticated-user-cache', () => ({ AuthenticatedUserCache: class {} }));
jest.mock('../user/user-authorship', () => ({ detachUserAuthorship: jest.fn().mockResolvedValue(0) }));
jest.mock('./account-deletion-request.entity', () => ({ AccountDeletionRequest: class AccountDeletionRequest {} }));
jest.mock('./repository/type-orm-account-deletion-request.repository', () => ({
	TypeOrmAccountDeletionRequestRepository: class {}
}));

import { GoneException } from '@nestjs/common';
import { AccountDeletionOutcomeEnum } from '@gauzy/contracts';
import { ACCOUNT_DELETION_INVALID_LINK_MESSAGE, AccountDeletionService } from './account-deletion.service';
import { generateAccountDeletionToken, hashAccountDeletionToken } from './account-deletion-token';

function setup() {
	const execute = jest.fn().mockResolvedValue({ affected: 1 });
	const queryBuilder = {
		update: jest.fn().mockReturnThis(),
		set: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		execute
	};
	const repository = {
		count: jest.fn().mockResolvedValue(0),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		create: jest.fn((value) => value),
		save: jest.fn(async (value) => ({ id: 'r1', ...value })),
		findOneBy: jest.fn(),
		createQueryBuilder: jest.fn(() => queryBuilder)
	};
	const transactionManager = { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
	const dataSource = {
		manager: {},
		transaction: jest.fn(async (work) => work(transactionManager))
	};
	const emailService = {
		sendAccountDeletionLink: jest.fn().mockResolvedValue(undefined),
		sendAccountDeletionCompleted: jest.fn().mockResolvedValue(undefined)
	};
	const cache = { forget: jest.fn() };
	const service = new AccountDeletionService(repository as any, dataSource as any, emailService as any, cache as any);
	const findUsers = jest.spyOn(service as any, 'findUsersByEmail');
	const plan = jest.spyOn(service as any, 'plan');
	jest.spyOn(service as any, 'collectStoredFiles').mockResolvedValue([]);
	jest.spyOn(service as any, 'scrubStaleAddresses').mockResolvedValue(undefined);
	return { service, repository, execute, dataSource, transactionManager, emailService, cache, findUsers, plan };
}

const user = { id: 'u1', tenantId: 't1', preferredLanguage: 'en' };

describe('AccountDeletionService', () => {
	describe('request', () => {
		it('does nothing visible for an address without accounts', async () => {
			const { service, findUsers, repository, emailService } = setup();
			findUsers.mockResolvedValue([]);

			await service.request({ email: 'nobody@ever.co' });

			expect(repository.save).not.toHaveBeenCalled();
			expect(emailService.sendAccountDeletionLink).not.toHaveBeenCalled();
		});

		it('stores only the token hash, revokes earlier links and emails a fragment link', async () => {
			const { service, findUsers, repository, emailService } = setup();
			findUsers.mockResolvedValue([user]);

			await service.request(
				{ email: ' Jane@Ever.co ', callbackUrl: 'https://evil.example/steal' },
				{ ip: '1.2.3.4', userAgent: 'test' }
			);

			expect(repository.update).toHaveBeenCalledWith(
				expect.objectContaining({ emailHash: expect.any(String) }),
				{ revokedAt: expect.any(Date) }
			);
			const stored = repository.save.mock.calls[0][0];
			expect(stored.email).toBe('jane@ever.co');
			expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
			expect(stored.requestIpHash).not.toContain('1.2.3.4');

			const { deletionLink, email } = emailService.sendAccountDeletionLink.mock.calls[0][0];
			expect(email).toBe('jane@ever.co');
			// The caller's link points at a foreign origin, so the deployment's own page is used.
			expect(deletionLink).toMatch(/^https:\/\/app\.gauzy\.co\/#\/auth\/delete-account\/confirm\?token=[A-Za-z0-9_-]{43}$/);
			const token = decodeURIComponent(deletionLink.split('token=')[1]);
			expect(hashAccountDeletionToken(token)).toBe(stored.tokenHash);
		});

		it('drops requests past the per-address limit', async () => {
			const { service, findUsers, repository, emailService } = setup();
			repository.count.mockResolvedValue(3);
			findUsers.mockResolvedValue([user]);

			await service.request({ email: 'jane@ever.co' });

			expect(findUsers).not.toHaveBeenCalled();
			expect(emailService.sendAccountDeletionLink).not.toHaveBeenCalled();
		});

		it('never throws, whatever fails', async () => {
			const { service, repository } = setup();
			repository.count.mockRejectedValue(new Error('db down'));

			await expect(service.request({ email: 'jane@ever.co' })).resolves.toBeUndefined();
		});
	});

	describe('preview', () => {
		it('answers the same 410 for malformed and unknown tokens', async () => {
			const { service, repository } = setup();
			repository.findOneBy.mockResolvedValue(null);

			await expect(service.preview('nope')).rejects.toThrow(new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE));
			await expect(service.preview(generateAccountDeletionToken())).rejects.toThrow(
				new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE)
			);
		});
	});

	describe('confirm', () => {
		it('refuses a token that is already used, revoked or expired (conditional update hit nothing)', async () => {
			const { service, execute, plan } = setup();
			execute.mockResolvedValue({ affected: 0 });

			await expect(service.confirm(generateAccountDeletionToken())).rejects.toBeInstanceOf(GoneException);
			expect(plan).not.toHaveBeenCalled();
		});

		it('deletes every account, clears the address from the audit row and emails a confirmation', async () => {
			const { service, repository, plan, transactionManager, emailService, cache } = setup();
			repository.findOneBy.mockResolvedValue({ id: 'r1', email: 'jane@ever.co', emailHash: 'h', locale: 'en' });
			plan.mockResolvedValue([
				{ user: { id: 'u1', tenantId: 't1' }, account: { outcome: AccountDeletionOutcomeEnum.WORKSPACE_DELETED } },
				{ user: { id: 'u2', tenantId: 't2' }, account: { outcome: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED } }
			]);

			const result = await service.confirm(generateAccountDeletionToken());

			expect(result).toEqual({ deleted: true, accounts: 2, workspacesDeleted: 1 });
			expect(transactionManager.delete).toHaveBeenCalledTimes(3); // tenant t1, user u1, user u2
			expect(repository.update).toHaveBeenCalledWith({ id: 'r1' }, expect.objectContaining({ email: null }));
			expect(emailService.sendAccountDeletionCompleted).toHaveBeenCalledWith(
				expect.objectContaining({ email: 'jane@ever.co', accounts: 2, workspacesDeleted: 1 })
			);
			expect(cache.forget).toHaveBeenCalledWith('u1');
			expect(cache.forget).toHaveBeenCalledWith('u2');
		});

		it('releases the link when the deletion fails, so the user can retry', async () => {
			const { service, repository, plan, dataSource } = setup();
			repository.findOneBy.mockResolvedValue({ id: 'r1', email: 'jane@ever.co', emailHash: 'h' });
			plan.mockResolvedValue([{ user: { id: 'u1' }, account: { outcome: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED } }]);
			dataSource.transaction.mockRejectedValue(new Error('fk violation'));

			await expect(service.confirm(generateAccountDeletionToken())).rejects.toThrow('fk violation');
			expect(repository.update).toHaveBeenCalledWith({ id: 'r1' }, { usedAt: null });
		});
	});
});
