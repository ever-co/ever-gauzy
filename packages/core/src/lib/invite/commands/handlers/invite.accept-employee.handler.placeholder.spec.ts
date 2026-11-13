import '../../../core/entities/internal';

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

function build(options: { placeholderEmployeeId: string | null; existingUserId?: string; employees?: Row[] }) {
	const invite = invitation(options.placeholderEmployeeId);
	const employees: Row[] = [...(options.employees ?? [])];
	const inviteService = {
		findOneByIdString: jest.fn(async () => invite),
		claimInvite: jest.fn(async () => true),
		releaseInvite: jest.fn(async () => undefined),
		update: jest.fn(async () => undefined)
	};
	const authService = {
		register: jest.fn(async () => ({ id: 'user-new', email: invite.email, tenantId: TENANT }))
	};
	const userRepository = {
		findOneOrFail: jest.fn(async () => {
			if (!options.existingUserId) throw new Error('EntityNotFound');
			return { id: options.existingUserId, email: invite.email, tenantId: TENANT };
		})
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
		placeholderTransferService as never,
		userOrganizationService as never
	);
	const accept = () =>
		handler.execute(new InviteAcceptEmployeeCommand({ inviteId: invite.id, user: {} } as never, 'en' as never));
	return { accept, placeholderTransferService, userOrganizationService, inviteService, employeeRepository };
}

describe('InviteAcceptEmployeeHandler with a claim invitation', () => {
	it('hands the placeholder over to the member the new account gets in the organization', async () => {
		const { accept, placeholderTransferService } = build({ placeholderEmployeeId: PLACEHOLDER });

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenCalledWith(PLACEHOLDER, 'employee-of-user-new', TENANT, {
			keepInviteId: 'invite-1'
		});
	});

	it("gives an existing account a member of the invitation's organization, never its member of another one", async () => {
		const { accept, placeholderTransferService, userOrganizationService } = build({
			placeholderEmployeeId: PLACEHOLDER,
			existingUserId: 'user-amina',
			employees: [{ id: 'employee-amina-elsewhere', userId: 'user-amina', organizationId: OTHER_ORGANIZATION }]
		});

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenCalledWith(
			PLACEHOLDER,
			'employee-of-user-amina',
			TENANT,
			{
				keepInviteId: 'invite-1'
			}
		);
		expect(userOrganizationService.addUserToOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-amina' }),
			ORGANIZATION
		);
	});

	it('hands the placeholder over to the member the account already has in the organization', async () => {
		const { accept, placeholderTransferService, employeeRepository } = build({
			placeholderEmployeeId: PLACEHOLDER,
			existingUserId: 'user-amina',
			employees: [{ id: 'employee-amina', userId: 'user-amina', organizationId: ORGANIZATION }]
		});

		await accept();

		expect(placeholderTransferService.transfer).toHaveBeenCalledWith(PLACEHOLDER, 'employee-amina', TENANT, {
			keepInviteId: 'invite-1'
		});
		expect(employeeRepository.save).not.toHaveBeenCalled();
	});

	it('hands nothing over for any other invitation', async () => {
		const { accept, placeholderTransferService } = build({ placeholderEmployeeId: null });

		await accept();

		expect(placeholderTransferService.transfer).not.toHaveBeenCalled();
	});

	it('gives the invitation back when the transfer fails', async () => {
		const { accept, placeholderTransferService, inviteService } = build({ placeholderEmployeeId: PLACEHOLDER });
		placeholderTransferService.transfer.mockRejectedValueOnce(new Error('transfer failed'));

		await expect(accept()).rejects.toThrow('transfer failed');

		expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
		expect(inviteService.update).not.toHaveBeenCalled();
	});
});
