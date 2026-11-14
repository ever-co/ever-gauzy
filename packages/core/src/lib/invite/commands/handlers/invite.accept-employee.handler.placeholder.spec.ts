import { Employee, User, UserOrganization } from '../../../core/entities/internal';

import { ConflictException } from '@nestjs/common';
import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';

/**
 * A claim invitation (ever-co/ever-gauzy#11913) is an employee invitation that hands a member without an account over
 * to the person who accepts it: with a new account or an existing one, the placeholder's time moves to the person's
 * member of the invitation's organization, never to a member of another organization. Any other invitation is accepted
 * as before.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';
const PLACEHOLDER = 'employee-amina-placeholder';

type Row = { id: string; userId: string; organizationId: string };
type Account = { id: string; email: string; tenantId: string; role?: { name: string }; deletedAt?: Date | null };

const invitation = (placeholderEmployeeId: string | null) => ({
	id: 'invite-1',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	email: 'amina@ever.co',
	placeholderEmployeeId,
	organization: { id: ORGANIZATION, tenantId: TENANT, invitesAllowed: true },
	projects: [],
	departments: [],
	organizationContacts: [],
	teams: []
});

function build(options: {
	placeholderEmployeeId: string | null;
	existingUserId?: string;
	existingRole?: string;
	employees?: Row[];
}) {
	const invite = invitation(options.placeholderEmployeeId);
	const employees: Row[] = [...(options.employees ?? [])];
	const existingUser = options.existingUserId
		? {
				id: options.existingUserId,
				email: invite.email,
				tenantId: TENANT,
				role: { name: options.existingRole ?? 'EMPLOYEE' }
			}
		: null;
	const inviteService = {
		findOneByIdString: jest.fn(async () => invite),
		claimInvite: jest.fn(async () => true),
		releaseInvite: jest.fn(async () => undefined),
		update: jest.fn(async () => undefined)
	};
	// The tenant's accounts: the existing one, if any, and those the acceptances register ('user-new', then
	// 'user-new-2', ...). A retired account keeps its row, soft-deleted.
	const users: Account[] = existingUser ? [existingUser] : [];
	const authService = {
		// Like AuthService.register: the saved account is told to `onSaved` before the steps that follow.
		register: jest.fn(async (_input: unknown, _language: unknown, onSaved?: (user: Account) => void) => {
			const id = users.some((user) => user.id === 'user-new') ? `user-new-${users.length + 1}` : 'user-new';
			const user = { id, email: invite.email, tenantId: TENANT, deletedAt: null };
			users.push(user);
			onSaved?.(user);
			return user;
		})
	};
	// The ordinary acceptance looks for an account with the EMPLOYEE role only (`findExistingEmployeeUser`).
	const userRepository = {
		findOneOrFail: jest.fn(async ({ where }) => {
			const roleMatches = !where.role?.name || where.role.name === existingUser?.role.name;
			if (!existingUser || !roleMatches) throw new Error('EntityNotFound');
			return existingUser;
		}),
		findOne: jest.fn(async ({ where }) => {
			const email = where.email?.objectLiteralParameters?.email ?? where.email;
			return users.find((user) => !user.deletedAt && user.email.toLowerCase() === email) ?? null;
		}),
		// The claim's lookup: the live accounts of the email, compared without regard to case (a `Raw` LOWER).
		find: jest.fn(async ({ where }) => {
			const email = where.email?.objectLiteralParameters?.email ?? where.email;
			return users.filter((user) => !user.deletedAt && user.email.toLowerCase() === email);
		}),
		// What a failed claim retires again: the account it registered, its members and its organization links.
		manager: {
			update: jest.fn(async (entity: unknown, where: Partial<Account>, values: Partial<Account>) => {
				if (entity === User) {
					users.filter((user) => user.id === where.id).forEach((user) => Object.assign(user, values));
				}
			})
		}
	};
	const employeeRepository = {
		findOneOrFail: jest.fn(async ({ where }) => {
			const found = employees.find((row) => row.userId === where.userId);
			if (!found) throw new Error('EntityNotFound');
			return found;
		}),
		findOne: jest.fn(
			async ({ where }) =>
				employees.find((row) => row.userId === where.userId && row.organizationId === where.organizationId) ??
				null
		),
		create: jest.fn((row) => ({ ...row })),
		save: jest.fn(async (row) => {
			const saved = {
				id: `employee-of-${row.user.id}`,
				userId: row.user.id,
				organizationId: row.organization.id
			};
			employees.push(saved);
			return saved;
		})
	};
	const placeholderTransferService = {
		transfer: jest.fn(async () => ({ timeLogs: 2, duration: 5400, timesheets: 1, taskAssignments: 0, teams: [] }))
	};
	const userOrganizationService = { addUserToOrganization: jest.fn(async () => undefined) };

	const handler = new InviteAcceptEmployeeHandler(
		inviteService as never,
		authService as never,
		userRepository as never,
		employeeRepository as never,
		undefined as never,
		undefined as never,
		undefined as never,
		undefined as never,
		placeholderTransferService as never
	);
	const accept = () =>
		handler.execute(new InviteAcceptEmployeeCommand({ inviteId: invite.id, user: {} } as never, 'en' as never));
	return {
		accept,
		placeholderTransferService,
		userOrganizationService,
		inviteService,
		employeeRepository,
		authService,
		userRepository,
		users
	};
}

describe('InviteAcceptEmployeeHandler with a claim invitation', () => {
	it('hands the placeholder over to the member the new account gets in the organization', async () => {
		const { accept, placeholderTransferService } = build({ placeholderEmployeeId: PLACEHOLDER });

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenCalledWith(PLACEHOLDER, 'employee-of-user-new', TENANT, {
			keepInviteId: 'invite-1'
		});
	});

	it('never opens an existing account, whatever its role, and hands nothing over', async () => {
		// Accepting signs in with the invitation alone: an existing account would be opened without its password.
		for (const existingRole of ['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']) {
			for (const organizationId of [ORGANIZATION, OTHER_ORGANIZATION]) {
				const { accept, placeholderTransferService, authService, inviteService, employeeRepository } = build({
					placeholderEmployeeId: PLACEHOLDER,
					existingUserId: 'user-amina',
					existingRole,
					employees: [{ id: 'employee-amina', userId: 'user-amina', organizationId }]
				});

				await expect(accept()).rejects.toBeInstanceOf(ConflictException);

				expect(authService.register).not.toHaveBeenCalled();
				expect(employeeRepository.save).not.toHaveBeenCalled();
				expect(placeholderTransferService.transfer).not.toHaveBeenCalled();
				expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
			}
		}
	});

	it('hands nothing over for any other invitation', async () => {
		const { accept, placeholderTransferService } = build({ placeholderEmployeeId: null });

		await accept();

		expect(placeholderTransferService.transfer).not.toHaveBeenCalled();
	});

	it('retires the account a failed claim registered, so that accepting again starts over', async () => {
		const { accept, placeholderTransferService, inviteService, userRepository } = build({
			placeholderEmployeeId: PLACEHOLDER
		});
		placeholderTransferService.transfer.mockRejectedValueOnce(new Error('transfer failed'));

		await expect(accept()).rejects.toThrow('transfer failed');

		// Otherwise the next acceptance would find that account and refuse the claim.
		const retired = { isActive: false, isArchived: true, deletedAt: expect.any(Date) };
		expect(userRepository.manager.update).toHaveBeenCalledWith(User, { id: 'user-new' }, retired);
		expect(userRepository.manager.update).toHaveBeenCalledWith(Employee, { userId: 'user-new' }, retired);
		expect(userRepository.manager.update).toHaveBeenCalledWith(UserOrganization, { userId: 'user-new' }, retired);
		expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenLastCalledWith(
			PLACEHOLDER,
			'employee-of-user-new-2',
			TENANT,
			{ keepInviteId: 'invite-1' }
		);
	});

	it('retires an account its registration saved before failing, so that accepting again starts over', async () => {
		const { accept, authService, placeholderTransferService, userRepository, users } = build({
			placeholderEmployeeId: PLACEHOLDER
		});
		// The account is saved, then a later step of the registration fails: the claim never gets it back.
		authService.register.mockImplementationOnce(async (_input, _language, onSaved) => {
			const user = { id: 'user-half', email: 'amina@ever.co', tenantId: TENANT, deletedAt: null };
			users.push(user);
			onSaved?.(user);
			throw new Error('organization link failed');
		});

		await expect(accept()).rejects.toThrow('organization link failed');

		const retired = { isActive: false, isArchived: true, deletedAt: expect.any(Date) };
		expect(userRepository.manager.update).toHaveBeenCalledWith(User, { id: 'user-half' }, retired);

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenCalledTimes(1);
	});

	it('never retires an account another registration made for the same email meanwhile', async () => {
		const { accept, placeholderTransferService, userRepository, users } = build({
			placeholderEmployeeId: PLACEHOLDER
		});
		// Someone registers the same email elsewhere while the claim runs, and then the claim fails.
		placeholderTransferService.transfer.mockImplementationOnce(async () => {
			users.push({ id: 'user-elsewhere', email: 'amina@ever.co', tenantId: TENANT, deletedAt: null });
			throw new Error('transfer failed');
		});

		await expect(accept()).rejects.toThrow('transfer failed');

		const { update } = userRepository.manager;
		expect(update).toHaveBeenCalledWith(User, { id: 'user-new' }, expect.anything());
		expect(update).not.toHaveBeenCalledWith(User, { id: 'user-elsewhere' }, expect.anything());
		expect(update).not.toHaveBeenCalledWith(Employee, { userId: 'user-elsewhere' }, expect.anything());
		expect(update).not.toHaveBeenCalledWith(UserOrganization, { userId: 'user-elsewhere' }, expect.anything());
	});

	it('still retires the account when retiring its member or its organization links fails', async () => {
		const { accept, placeholderTransferService, userRepository } = build({ placeholderEmployeeId: PLACEHOLDER });
		placeholderTransferService.transfer.mockRejectedValueOnce(new Error('transfer failed'));
		const update = userRepository.manager.update.getMockImplementation();
		userRepository.manager.update.mockImplementation(
			async (entity: unknown, where: Partial<Account>, values: Partial<Account>) => {
				if (entity !== User) throw new Error(`${String((entity as { name?: string }).name)} update failed`);
				return update?.(entity, where, values);
			}
		);

		await expect(accept()).rejects.toThrow('transfer failed');

		expect(userRepository.manager.update).toHaveBeenCalledWith(User, { id: 'user-new' }, expect.anything());
		await expect(accept()).resolves.toBeDefined();
	});

	it('gives the invitation back when the transfer fails', async () => {
		const { accept, placeholderTransferService, inviteService } = build({ placeholderEmployeeId: PLACEHOLDER });
		placeholderTransferService.transfer.mockRejectedValueOnce(new Error('transfer failed'));

		await expect(accept()).rejects.toThrow('transfer failed');

		expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
		expect(inviteService.update).not.toHaveBeenCalled();
	});
});
