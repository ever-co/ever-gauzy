// The handler is exercised with its collaborators stubbed; importing the real services drags in the whole
// core entity graph (pre-existing circular import). Same technique as role-assignment.handlers.spec.ts.
jest.mock('../../../auth/auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../../email-send/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../../../role/role.service', () => ({ RoleService: class RoleService {} }));
jest.mock('../../../user/user.service', () => ({ UserService: class UserService {} }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeKindEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeCreateCommand } from '../employee.create.command';
import { EmployeeCreateHandler } from './employee.create.handler';

const TENANT = 'tenant-1';
const ORGANIZATION = 'org-2';
const AGENT_USER = {
	id: 'user-agent',
	email: 'agent-1@agents.invalid',
	hash: null,
	role: { name: RolesEnum.EMPLOYEE }
};
const PERSON_USER = { id: 'user-person', email: 'ada@example.com', hash: 'digest', role: { name: RolesEnum.EMPLOYEE } };

/**
 * `POST /employee` files people. An account that stands behind an agent employee (in any organization of the
 * tenant) is refused there with 409 — by email and by `userId` — instead of being filed as a `human` who is
 * paid, counted and invited.
 */
describe('EmployeeCreateHandler refuses the account of an agent', () => {
	let agentUserIds: Set<string>;
	let employeeService: {
		assertNotAgentAccount: jest.Mock;
		findOneByWhereOptions: jest.Mock;
		create: jest.Mock;
	};
	let userService: { findOneByOptions: jest.Mock; findOneByIdString: jest.Mock };
	let userOrganizationService: { addUserToOrganization: jest.Mock };
	let handler: EmployeeCreateHandler;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		agentUserIds = new Set([AGENT_USER.id]);
		employeeService = {
			// What EmployeeService.assertNotAgentAccount answers: 409 for an account with an agent employee.
			assertNotAgentAccount: jest.fn(async (userId: string, tenantId: string) => {
				if (tenantId === TENANT && agentUserIds.has(userId)) {
					throw new ConflictException('This user stands behind an agent employee.');
				}
			}),
			findOneByWhereOptions: jest.fn(async () => {
				throw new NotFoundException();
			}),
			create: jest.fn(async (input: any) => ({ id: 'employee-new', ...input }))
		};
		userService = {
			findOneByOptions: jest.fn(async ({ where }: any) => {
				const user = [AGENT_USER, PERSON_USER].find((candidate) => candidate.email === where.email);
				if (!user) throw new NotFoundException();
				return user;
			}),
			findOneByIdString: jest.fn(async (id: string) => [AGENT_USER, PERSON_USER].find((u) => u.id === id))
		};
		userOrganizationService = { addUserToOrganization: jest.fn() };
		handler = new EmployeeCreateHandler(
			{ execute: jest.fn() } as any,
			employeeService as any,
			userOrganizationService as any,
			{ getPasswordHash: jest.fn() } as any,
			{ welcomeUser: jest.fn() } as any,
			{ findOneByWhereOptions: jest.fn() } as any,
			userService as any
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses the email of an agent account with 409 and files nothing', async () => {
		await expect(
			handler.execute(
				new EmployeeCreateCommand({ organizationId: ORGANIZATION, user: { email: AGENT_USER.email } } as any)
			)
		).rejects.toBeInstanceOf(ConflictException);

		expect(employeeService.assertNotAgentAccount).toHaveBeenCalledWith(AGENT_USER.id, TENANT);
		expect(employeeService.create).not.toHaveBeenCalled();
		expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
	});

	it('refuses the userId of an agent account with 409 and files nothing', async () => {
		await expect(
			handler.execute(new EmployeeCreateCommand({ organizationId: ORGANIZATION, userId: AGENT_USER.id } as any))
		).rejects.toBeInstanceOf(ConflictException);

		expect(employeeService.assertNotAgentAccount).toHaveBeenCalledWith(AGENT_USER.id, TENANT);
		expect(employeeService.create).not.toHaveBeenCalled();
	});

	it('CONTROL: without the check, the agent account was filed as a human employee', async () => {
		employeeService.assertNotAgentAccount.mockResolvedValue(undefined);

		const employee = await handler.execute(
			new EmployeeCreateCommand({ organizationId: ORGANIZATION, userId: AGENT_USER.id } as any)
		);

		expect(employee).toMatchObject({ kind: EmployeeKindEnum.HUMAN, user: AGENT_USER });
	});

	it('still files an existing person, by email and by userId', async () => {
		const byEmail = await handler.execute(
			new EmployeeCreateCommand({ organizationId: ORGANIZATION, user: { email: PERSON_USER.email } } as any)
		);
		const byId = await handler.execute(
			new EmployeeCreateCommand({ organizationId: ORGANIZATION, userId: PERSON_USER.id } as any)
		);

		expect(byEmail).toMatchObject({ kind: EmployeeKindEnum.HUMAN, user: PERSON_USER });
		expect(byId).toMatchObject({ kind: EmployeeKindEnum.HUMAN, user: PERSON_USER });
		expect(userOrganizationService.addUserToOrganization).toHaveBeenCalledWith(PERSON_USER, ORGANIZATION);
	});
});
