import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EXISTING_ACCOUNT_SIGN_IN_REQUIRED_MESSAGE } from '../../existing-account-sign-in-required';
import { InviteAcceptCommand } from '../invite-accept.command';
import { InviteAcceptHandler } from './invite-accept.handler';

/**
 * Whoever sends an invitation can read its token and its code, so they never open an account that already exists:
 * that account accepts from its own signed-in session. An address without an account registers as before.
 */
const TENANT = 'tenant-1';
const INVITED_EMAIL = 'nadia.rahman@example.com';

type Account = { id: string; email: string; tenantId: string; isActive?: boolean; isArchived?: boolean };

const account = (id: string, overrides: Partial<Account> = {}): Account => ({
	id,
	email: INVITED_EMAIL,
	tenantId: TENANT,
	...overrides
});

function build(options: { accounts?: Account[]; role?: string; sessionUserId?: string | null } = {}) {
	const roleName = options.role ?? RolesEnum.EMPLOYEE;
	const invite = { id: 'invite-1', email: INVITED_EMAIL, tenantId: TENANT };
	const inviteService = {
		validateByCode: jest.fn(async () => invite),
		validateByToken: jest.fn(async () => invite),
		findOneByIdString: jest.fn(async () => ({
			...invite,
			role: { id: 'role-1', name: roleName },
			tenant: { id: TENANT }
		}))
	};
	const accounts = options.accounts ?? [];
	const accepted = account('user-accepted');
	const userRepository = {
		find: jest.fn(async ({ where }) => {
			const invitedEmail = where.email.objectLiteralParameters.email;
			return accounts.filter((row) => row.tenantId === where.tenantId && row.email.toLowerCase() === invitedEmail);
		}),
		findOneOrFail: jest.fn(async () => accepted)
	};
	const commandBus = { execute: jest.fn(async () => accepted) };
	const authService = {
		asksForTwoFactorCode: jest.fn(async () => false),
		getJwtAccessToken: jest.fn(async () => 'access-token'),
		getJwtRefreshToken: jest.fn(async () => 'refresh-token')
	};
	const userService = { setCurrentRefreshToken: jest.fn(async () => undefined) };
	const employeeService = { findOneByUserId: jest.fn(async () => null) };

	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(options.sessionUserId ?? null);

	const handler = new InviteAcceptHandler(
		userRepository as never,
		commandBus as never,
		inviteService as never,
		authService as never,
		userService as never,
		employeeService as never
	);
	const accept = () =>
		handler.execute(
			new InviteAcceptCommand(
				{ email: INVITED_EMAIL, code: '482913', user: { email: INVITED_EMAIL }, password: 'unused' } as never,
				'en' as never
			)
		);

	return { accept, commandBus };
}

describe('accepting an invitation for an address that already has an account', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('registers an address without an account and signs it in, as before', async () => {
		const { accept, commandBus } = build();

		const answer = await accept();

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(answer).toMatchObject({ token: 'access-token', refresh_token: 'refresh-token' });
	});

	it.each([RolesEnum.EMPLOYEE, RolesEnum.CANDIDATE, RolesEnum.MANAGER])(
		'refuses a %s invitation accepted without a session, and writes nothing',
		async (role) => {
			const { accept, commandBus } = build({ accounts: [account('user-admin')], role });

			await expect(accept()).rejects.toMatchObject({
				status: 409,
				message: EXISTING_ACCOUNT_SIGN_IN_REQUIRED_MESSAGE
			});
			expect(commandBus.execute).not.toHaveBeenCalled();
		}
	);

	it('refuses the session of another account, such as the person who sent the invitation', async () => {
		const { accept, commandBus } = build({ accounts: [account('user-admin')], sessionUserId: 'user-inviter' });

		await expect(accept()).rejects.toMatchObject({ status: 409 });
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('finds the account when the address differs only by case', async () => {
		const stored = account('user-admin', { email: 'Nadia.Rahman@example.com' });
		const { accept, commandBus } = build({ accounts: [stored] });

		await expect(accept()).rejects.toMatchObject({ status: 409 });
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it("accepts from the account's own session", async () => {
		const { accept, commandBus } = build({ accounts: [account('user-admin')], sessionUserId: 'user-admin' });

		await accept();

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
	});

	it('leaves an address whose only account can no longer sign in to the acceptance it had', async () => {
		const deactivated = account('user-old', { isActive: false });
		const archived = account('user-older', { isArchived: true });
		const { accept, commandBus } = build({ accounts: [deactivated, archived] });

		await accept();

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
	});

	it('does not count an account of the same address in another tenant', async () => {
		const elsewhere = account('user-elsewhere', { tenantId: 'tenant-2' });
		const { accept, commandBus } = build({ accounts: [elsewhere] });

		await accept();

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
	});
});
