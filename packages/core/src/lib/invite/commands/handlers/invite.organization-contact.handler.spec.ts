/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — see the
 * note in `time-log.service.spec.ts`: the entity graph has to finish initializing before anything
 * applies `@IsEmployeeBelongsToOrganization()`.
 */
import '../../../core/entities/internal';
import { RolesEnum } from '@gauzy/contracts';
import { InviteOrganizationContactHandler } from './invite.organization-contact.handler';
import { InviteOrganizationContactCommand } from '../invite.organization-contact.command';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const CONTACT_EMAIL = 'contact@example.com';

const TENANT_A_USER = { id: 'aaaa', email: CONTACT_EMAIL, tenantId: TENANT_A };
const TENANT_B_USER = { id: 'bbbb', email: CONTACT_EMAIL, tenantId: TENANT_B };

/** Same double as the user-service suite: `undefined` criteria keys are dropped, not matched. */
const lookupIn = (rows: Array<Record<string, unknown>>) => ({
	getUserByEmail: jest.fn(async (email: string) => rows.find((row) => row.email === email) ?? null),
	getUserByEmailInTenant: jest.fn(
		async (email: string, tenantId: string) =>
			rows.find((row) => row.email === email && row.tenantId === tenantId) ?? null
	)
});

const buildHandler = (rows: Array<Record<string, unknown>>) => {
	const userService = lookupIn(rows);
	const organizationContactService = {
		findOneByIdString: jest.fn().mockResolvedValue({
			id: CONTACT_ID,
			primaryEmail: CONTACT_EMAIL,
			organizationId: 'org-1'
		}),
		update: jest.fn().mockResolvedValue(undefined)
	};
	const inviteService = { createOrganizationContactInvite: jest.fn().mockResolvedValue(undefined) };
	const roleService = {
		findOneByOptions: jest.fn().mockResolvedValue({ id: 'role-viewer', name: RolesEnum.VIEWER })
	};

	const handler = new InviteOrganizationContactHandler(
		organizationContactService as any,
		inviteService as any,
		userService as any,
		roleService as any
	);

	return { handler, userService, inviteService, organizationContactService };
};

const command = (tenantId: string) =>
	new InviteOrganizationContactCommand({
		id: CONTACT_ID,
		originalUrl: 'https://app.example',
		inviterUser: { id: 'inviter', tenantId } as any,
		languageCode: 'en' as any
	});

describe('InviteOrganizationContactHandler.userExistsForSameTenant (GHSA-6qvm-3wg4-26w4 residual)', () => {
	beforeEach(() => {
		// The handler logs the rejection path; keep the suite output readable.
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sends the invite when the only account with that address lives in ANOTHER tenant', async () => {
		const { handler, userService, inviteService } = buildHandler([TENANT_B_USER]);

		await expect(handler.execute(command(TENANT_A))).resolves.toMatchObject({ id: CONTACT_ID });

		expect(userService.getUserByEmail).not.toHaveBeenCalled();
		expect(userService.getUserByEmailInTenant).toHaveBeenCalledWith(CONTACT_EMAIL, TENANT_A);
		expect(inviteService.createOrganizationContactInvite).toHaveBeenCalledTimes(1);
	});

	it('still refuses when the address already belongs to a user of the SAME tenant', async () => {
		const { handler, inviteService } = buildHandler([TENANT_A_USER]);

		await expect(handler.execute(command(TENANT_A))).rejects.toThrow(
			'Contact email already exists in the account as a user'
		);
		expect(inviteService.createOrganizationContactInvite).not.toHaveBeenCalled();
	});

	it('fails closed when the inviter carries no tenant', async () => {
		const { handler, inviteService } = buildHandler([]);

		await expect(handler.execute(command(undefined as any))).rejects.toThrow(
			'Cannot invite an organization contact without a tenant context.'
		);
		expect(inviteService.createOrganizationContactInvite).not.toHaveBeenCalled();
	});

	it('CONTROL: the global lookup this used to call reports a foreign-tenant account as "already exists"', async () => {
		const { userService } = buildHandler([TENANT_B_USER]);

		// The pre-fix body was `user = await this.userService.getUserByEmail(email); … return true;`
		// — the tenantId argument was accepted and then ignored.
		const preFix = !!(await userService.getUserByEmail(CONTACT_EMAIL));
		const fixed = !!(await userService.getUserByEmailInTenant(CONTACT_EMAIL, TENANT_A));

		expect(preFix).toBe(true); // leaks that some other tenant holds that address
		expect(fixed).toBe(false);
	});
});
