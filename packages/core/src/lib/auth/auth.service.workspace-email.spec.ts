import '../core/entities/internal';

import { UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * GET /auth/workspaces and POST /auth/switch-workspace find the caller's other accounts by the caller's
 * CURRENT e-mail address. A user sets their own address through `PUT /user/:id` and it is stored
 * unconfirmed, so before this check anyone could type another person's address into a profile they
 * control and be handed that person's accounts, in every tenant, with their tokens.
 *
 * Only a caller whose address is confirmed (`emailVerifiedAt`) reaches the other accounts that share it;
 * an unconfirmed caller reaches their own account only.
 */
describe('AuthService workspace routes and the caller e-mail address', () => {
	const TARGET_TENANT = '22222222-2222-4222-8222-222222222222';
	const CALLER = { id: 'caller', email: 'victim@ever.co', tenantId: '11111111-1111-4111-8111-111111111111' };

	let users: { find: jest.Mock; findOne: jest.Mock };
	let service: AuthService;

	beforeEach(() => {
		users = { find: jest.fn(async () => []), findOne: jest.fn(async () => null) };

		// Only the collaborators these paths touch; the rest of the constructor graph is irrelevant here.
		service = Object.create(AuthService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmUserRepository: users,
			logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() }
		});
	});

	afterEach(() => jest.restoreAllMocks());

	const signedInAs = (user: object) => jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);

	describe('getUserWorkspaces', () => {
		it('limits an unconfirmed address to the caller own account', async () => {
			signedInAs({ ...CALLER, emailVerifiedAt: null });

			await expect(service.getUserWorkspaces()).rejects.toBeInstanceOf(UnauthorizedException);

			expect(users.find).toHaveBeenCalledTimes(1);
			expect(users.find.mock.calls[0][0].where).toMatchObject({ email: CALLER.email, id: CALLER.id });
		});

		it('reaches every account that shares a confirmed address', async () => {
			signedInAs({ ...CALLER, emailVerifiedAt: new Date('2026-01-01T00:00:00Z') });

			await expect(service.getUserWorkspaces()).rejects.toBeInstanceOf(UnauthorizedException);

			expect(users.find).toHaveBeenCalledTimes(1);
			const { where } = users.find.mock.calls[0][0];
			expect(where).toMatchObject({ email: CALLER.email, isActive: true, isArchived: false });
			expect(where).not.toHaveProperty('id');
		});
	});

	describe('switchWorkspace', () => {
		it('limits an unconfirmed address to the caller own account', async () => {
			signedInAs({ ...CALLER, emailVerifiedAt: null });

			await expect(service.switchWorkspace(TARGET_TENANT)).rejects.toBeInstanceOf(UnauthorizedException);

			expect(users.findOne).toHaveBeenCalledTimes(1);
			expect(users.findOne.mock.calls[0][0].where).toMatchObject({
				email: CALLER.email,
				tenantId: TARGET_TENANT,
				id: CALLER.id
			});
		});

		it('reaches the account that shares a confirmed address in the target tenant', async () => {
			signedInAs({ ...CALLER, emailVerifiedAt: new Date('2026-01-01T00:00:00Z') });

			await expect(service.switchWorkspace(TARGET_TENANT)).rejects.toBeInstanceOf(UnauthorizedException);

			expect(users.findOne).toHaveBeenCalledTimes(1);
			const { where } = users.findOne.mock.calls[0][0];
			expect(where).toMatchObject({ email: CALLER.email, tenantId: TARGET_TENANT });
			expect(where).not.toHaveProperty('id');
		});
	});
});
