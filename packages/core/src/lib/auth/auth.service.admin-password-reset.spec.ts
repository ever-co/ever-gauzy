/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before anything applies `@IsEmployeeBelongsToOrganization()`. See the note
 * in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { BadRequestException } from '@nestjs/common';
import { environment, IAuthSwitches } from '@gauzy/config';
import { LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../core/utils';
import { AuthService } from './auth.service';
import { signPurposeToken, TokenPurposeEnum } from './purpose-token';

/**
 * #7821: `ADMIN_PASSWORD_RESET=false` stops the e-mailed password reset for Admin and Super Admin accounts.
 *
 * `POST /auth/request-password` answers exactly as for an address without an account (no enumeration) and sends
 * no link for those accounts; `POST /auth/reset-password` refuses a link such an account got earlier, before the
 * token is consumed. Every other account, and every account while the switch is on (the default), is unchanged.
 */

const EMAIL = 'owner@corp.test';
const TENANT_A = '9a000000-0000-4000-8000-00000000000a';
const TENANT_B = '9b000000-0000-4000-8000-00000000000b';

const switches = environment as unknown as { authSwitches: IAuthSwitches };
let previousSwitches: IAuthSwitches;

function setAdminPasswordReset(enabled: boolean) {
	switches.authSwitches = { ...switches.authSwitches, adminPasswordReset: enabled };
}

const account = (id: string, role: RolesEnum, tenantId = TENANT_A) => ({
	id,
	email: EMAIL,
	tenantId,
	tenant: { id: tenantId, name: `Tenant ${tenantId.slice(0, 2)}` },
	role: { name: role }
});

/** An AuthService wired with only what the two reset routes touch. */
function buildService(users: any[] = []) {
	const service: any = Object.create(AuthService.prototype);
	Object.defineProperty(service, 'ormType', { get: () => MultiORMEnum.TypeORM });
	service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
	service.fetchUsers = jest.fn(async () => users);
	service.typeOrmPasswordResetRepository = { delete: jest.fn(async () => ({ affected: 1 })) };
	service.commandBus = { execute: jest.fn(async () => ({ id: 'reset-record', expired: false })) };
	service.emailService = { requestPassword: jest.fn(), multiTenantResetPassword: jest.fn() };
	service.passwordHashService = { hash: jest.fn(async () => '$2b$10$new-hash') };
	service.userService = {
		findOneByIdString: jest.fn(async (id: string) => users.find((user) => user.id === id) ?? null),
		changePassword: jest.fn(async () => undefined)
	};
	return service as AuthService & Record<string, any>;
}

const resetTokenFor = (user: { id: string; tenantId: string }) =>
	signPurposeToken(TokenPurposeEnum.PASSWORD_RESET, { id: user.id, tenantId: user.tenantId }, { expiresIn: '10m' });

beforeEach(() => {
	previousSwitches = switches.authSwitches;
	switches.authSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };
});

afterEach(() => {
	switches.authSwitches = previousSwitches;
	jest.restoreAllMocks();
});

describe('AuthService.requestResetPassword — ADMIN_PASSWORD_RESET', () => {
	it('sends an Admin their link with the default switch (today’s behaviour)', async () => {
		const service = buildService([account('admin-1', RolesEnum.ADMIN)]);

		await expect(service.requestResetPassword({ email: EMAIL }, LanguagesEnum.ENGLISH)).resolves.toBe(true);

		expect(service.emailService.requestPassword).toHaveBeenCalledTimes(1);
	});

	it.each([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN])(
		'answers as for an unknown address and sends nothing to a %s while the switch is off',
		async (role) => {
			setAdminPasswordReset(false);
			const service = buildService([account('admin-1', role)]);
			const unknown = buildService([]);

			const answer = await service.requestResetPassword({ email: EMAIL }, LanguagesEnum.ENGLISH);

			// The same answer an address without any account gets.
			expect(answer).toBe(await unknown.requestResetPassword({ email: EMAIL }, LanguagesEnum.ENGLISH));
			expect(answer).toBe(true);
			expect(service.emailService.requestPassword).not.toHaveBeenCalled();
			expect(service.emailService.multiTenantResetPassword).not.toHaveBeenCalled();
			// No reset record and no token were created for the account.
			expect(service.commandBus.execute).not.toHaveBeenCalled();
			expect(service.logger.log).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD_RESET is false'));
			// The log line names no address.
			expect(service.logger.log.mock.calls[0][0]).not.toContain(EMAIL);
		}
	);

	it('still sends an Employee their link while the switch is off', async () => {
		setAdminPasswordReset(false);
		const employee = account('employee-1', RolesEnum.EMPLOYEE);
		const service = buildService([employee]);

		await service.requestResetPassword({ email: EMAIL }, LanguagesEnum.ENGLISH);

		expect(service.emailService.requestPassword).toHaveBeenCalledWith(
			employee,
			expect.stringContaining('/auth/reset-password?'),
			LanguagesEnum.ENGLISH,
			undefined
		);
	});

	it('links only the non-admin workspace when one address is Admin in one tenant and Employee in another', async () => {
		setAdminPasswordReset(false);
		const admin = account('admin-1', RolesEnum.ADMIN, TENANT_A);
		const employee = account('employee-1', RolesEnum.EMPLOYEE, TENANT_B);
		const service = buildService([admin, employee]);

		await service.requestResetPassword({ email: EMAIL }, LanguagesEnum.ENGLISH);

		// One account left: the single-account e-mail, for the Employee only.
		expect(service.emailService.multiTenantResetPassword).not.toHaveBeenCalled();
		expect(service.emailService.requestPassword).toHaveBeenCalledTimes(1);
		expect(service.emailService.requestPassword.mock.calls[0][0]).toBe(employee);
	});
});

describe('AuthService.resetPassword — ADMIN_PASSWORD_RESET', () => {
	it('resets an Admin’s password with the default switch (today’s behaviour)', async () => {
		const admin = account('admin-1', RolesEnum.ADMIN);
		const service = buildService([admin]);

		await expect(service.resetPassword({ token: resetTokenFor(admin), password: 'new-password' } as any)).resolves.toBe(
			true
		);

		expect(service.userService.changePassword).toHaveBeenCalledWith('admin-1', '$2b$10$new-hash');
		expect(service.userService.findOneByIdString).toHaveBeenCalledWith('admin-1', {
			where: { tenantId: TENANT_A },
			relations: { tenant: true, role: true }
		});
	});

	it.each([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN])(
		'refuses a %s’s earlier link while the switch is off, without consuming it',
		async (role) => {
			setAdminPasswordReset(false);
			const admin = account('admin-1', role);
			const service = buildService([admin]);

			await expect(
				service.resetPassword({ token: resetTokenFor(admin), password: 'new-password' } as any)
			).rejects.toThrow(new BadRequestException('Password Reset Failed.'));

			expect(service.userService.changePassword).not.toHaveBeenCalled();
			expect(service.typeOrmPasswordResetRepository.delete).not.toHaveBeenCalled();
		}
	);

	it('still resets an Employee’s password while the switch is off', async () => {
		setAdminPasswordReset(false);
		const employee = account('employee-1', RolesEnum.EMPLOYEE);
		const service = buildService([employee]);

		await expect(
			service.resetPassword({ token: resetTokenFor(employee), password: 'new-password' } as any)
		).resolves.toBe(true);

		expect(service.userService.changePassword).toHaveBeenCalledWith('employee-1', '$2b$10$new-hash');
	});
});
