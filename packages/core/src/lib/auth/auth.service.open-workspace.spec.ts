import '../core/entities/internal';

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { RequestContext } from '../core/context';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WORKSPACE_ADDRESS_UNPROVEN_MESSAGE } from './open-workspace';

/**
 * ever-co/ever-teams#5025: a signed-in person opens another workspace without signing out. `POST /auth/workspaces`
 * answers the account the workspace is created with (their address in no tenant yet, without a password), as a
 * workspace sign-in token the app exchanges at `/auth/signin.workspace` before it creates the tenant, the
 * organization and the first team through the sign-up routes.
 */
describe('AuthService.openWorkspace', () => {
	const PROVEN = new Date('2026-01-01T00:00:00Z');
	const CALLER = {
		id: 'caller',
		email: 'ada@ever.co',
		tenantId: '11111111-1111-4111-8111-111111111111',
		firstName: 'Ada',
		lastName: 'Lovelace',
		imageUrl: 'https://images.example.com/ada.png',
		timeZone: 'Europe/Paris',
		preferredLanguage: 'fr',
		hash: 'the-caller-password-hash',
		emailVerifiedAt: PROVEN
	};

	let users: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
	let service: AuthService;
	/** What the database holds: the caller's record, and an account an earlier attempt left without a workspace. */
	let callerRecord: Record<string, unknown> | null;
	let unfinished: Record<string, unknown> | null;

	beforeEach(() => {
		callerRecord = { ...CALLER };
		unfinished = null;
		users = {
			findOne: jest.fn(async ({ where }) => (where.id ? callerRecord : unfinished)),
			create: jest.fn((fields) => ({ ...fields })),
			save: jest.fn(async (entity) => ({ ...entity, id: 'new-account' })),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		// Only the collaborators this path touches; the rest of the constructor graph is irrelevant here.
		service = Object.create(AuthService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmUserRepository: users,
			logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() }
		});
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: CALLER.id,
			tenantId: CALLER.tenantId
		} as never);
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The workspace sign-in the answer carries, read as `/auth/signin.workspace` reads it. */
	const signinOf = (token: string) =>
		(service as unknown as { verifyToken(token: string): Record<string, unknown> }).verifyToken(token);

	it("opens an account for the caller's proven address: no tenant, no password, their name and settings", async () => {
		const opening = await service.openWorkspace();

		expect(users.create).toHaveBeenCalledWith({
			email: CALLER.email,
			firstName: CALLER.firstName,
			lastName: CALLER.lastName,
			imageUrl: CALLER.imageUrl,
			timeZone: CALLER.timeZone,
			preferredLanguage: CALLER.preferredLanguage,
			isActive: true,
			isArchived: false
		});
		const created = users.create.mock.calls[0][0];
		expect(created).not.toHaveProperty('hash');
		expect(created).not.toHaveProperty('tenant');
		expect(created).not.toHaveProperty('role');
		// The address is proven as the caller's is: written after the insert, which leaves the column out
		expect(users.update).toHaveBeenCalledWith({ id: 'new-account' }, { emailVerifiedAt: PROVEN });

		expect(opening.email).toBe(CALLER.email);
		expect(signinOf(opening.token)).toMatchObject({ userId: 'new-account', email: CALLER.email, tenantId: null });
	});

	it('answers again the account an earlier attempt left without a workspace, rather than another one', async () => {
		unfinished = { id: 'unfinished', email: CALLER.email, tenantId: null, hash: null };

		const opening = await service.openWorkspace();

		expect(users.create).not.toHaveBeenCalled();
		expect(users.findOne.mock.calls[1][0].where).toEqual({
			email: CALLER.email,
			tenantId: IsNull(),
			hash: IsNull(),
			isActive: true,
			isArchived: false
		});
		expect(signinOf(opening.token)).toMatchObject({ userId: 'unfinished', email: CALLER.email, tenantId: null });
	});

	it("reads the caller's own record for the address and its proof, not the request's user", async () => {
		await service.openWorkspace();

		expect(users.findOne.mock.calls[0][0].where).toEqual({
			id: CALLER.id,
			tenantId: CALLER.tenantId,
			isActive: true,
			isArchived: false
		});
	});

	it('opens nothing for an address the caller has not proven: they would not even see the workspace', async () => {
		callerRecord = { ...CALLER, emailVerifiedAt: null };

		await expect(service.openWorkspace()).rejects.toThrow(
			new ForbiddenException(WORKSPACE_ADDRESS_UNPROVEN_MESSAGE)
		);
		expect(users.create).not.toHaveBeenCalled();
	});

	it('opens nothing for a third-party application token', async () => {
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['read:timesheet']);

		await expect(service.openWorkspace()).rejects.toBeInstanceOf(ForbiddenException);
		expect(users.findOne).not.toHaveBeenCalled();
	});

	it('opens nothing without a signed-in user', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null as never);

		await expect(service.openWorkspace()).rejects.toBeInstanceOf(UnauthorizedException);
		expect(users.findOne).not.toHaveBeenCalled();
	});
});

describe('POST /auth/workspaces', () => {
	it('is refused while the operator has closed tenant registration, before any account is opened', async () => {
		const authService = { openWorkspace: jest.fn() };
		const registrationPolicy = {
			assertTenantRegistrationOpen: jest.fn(async () => {
				throw new ForbiddenException('closed');
			})
		};
		const controller = new AuthController(authService as never, {} as never, registrationPolicy as never);

		await expect(controller.openWorkspace()).rejects.toBeInstanceOf(ForbiddenException);
		expect(authService.openWorkspace).not.toHaveBeenCalled();
	});

	it('answers the opening while tenant registration is open', async () => {
		const opening = { email: 'ada@ever.co', token: 'workspace-signin-token' };
		const authService = { openWorkspace: jest.fn(async () => opening) };
		const registrationPolicy = { assertTenantRegistrationOpen: jest.fn(async () => undefined) };
		const controller = new AuthController(authService as never, {} as never, registrationPolicy as never);

		await expect(controller.openWorkspace()).resolves.toBe(opening);
	});
});
