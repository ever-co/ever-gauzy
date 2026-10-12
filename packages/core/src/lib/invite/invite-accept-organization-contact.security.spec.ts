/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies
 * `@IsEmployeeBelongsToOrganization()`. See the note in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { CurrenciesEnum, RolesEnum } from '@gauzy/contracts';
import { AcceptOrganizationContactInviteDTO } from './dto';
import { InviteController } from './invite.controller';
import {
	InviteAcceptOrganizationContactHandler,
	sanitizeContactOrganization
} from './commands/handlers/invite.accept-organization-contact.handler';
import { InviteAcceptOrganizationContactCommand } from './commands/invite.accept-organization-contact.command';

const INVITE_ID = '33333333-3333-4333-8333-333333333333';
const VICTIM_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const VICTIM_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const NEW_TENANT_ID = '77777777-7777-4777-8777-777777777777';
const NEW_ORGANIZATION_ID = '88888888-8888-4888-8888-888888888888';
const CONTACT_ID = '99999999-9999-4999-8999-999999999999';
const INVITED_EMAIL = 'client@example.com';

/** What the accept-client-invite form emits, plus the `inviteId` its page adds. */
const uiBody = (overrides: Record<string, unknown> = {}) => ({
	user: {
		firstName: 'Grace',
		lastName: 'Hopper',
		email: INVITED_EMAIL,
		role: { id: 'role-viewer', name: RolesEnum.VIEWER },
		tenant: undefined,
		tags: undefined
	},
	password: 'correct-horse',
	contactOrganization: { name: 'Client Co', currency: CurrenciesEnum.USD, city: 'Sofia' },
	inviteId: INVITE_ID,
	...overrides
});

describe('POST /invite/contact cannot carry privileged fields into the sinks (GHSA-929w-5p4w-cxjp residual)', () => {
	describe('AcceptOrganizationContactInviteDTO whitelist', () => {
		const pipe = new ValidationPipe({ whitelist: true, transform: true });
		const run = (value: unknown) =>
			pipe.transform(value, { type: 'body', metatype: AcceptOrganizationContactInviteDTO } as any);

		it('keeps everything the accept-client-invite form needs', async () => {
			const result: any = await run(uiBody());

			expect(result.inviteId).toBe(INVITE_ID);
			expect(result.password).toBe('correct-horse');
			expect(result.user).toMatchObject({ firstName: 'Grace', lastName: 'Hopper' });
			expect(result.contactOrganization).toEqual({ name: 'Client Co', currency: CurrenciesEnum.USD, city: 'Sofia' });
		});

		it('strips the cascading membership relation and every other decisive user field', async () => {
			const result: any = await run(
				uiBody({
					originalUrl: 'https://attacker.example',
					organizationId: VICTIM_ORGANIZATION_ID,
					featureAsEmployee: true,
					id: 'some-employee-id',
					user: {
						firstName: 'Grace',
						id: 'another-users-id',
						roleId: 'super-admin-role',
						tenantId: VICTIM_TENANT_ID,
						organizations: [{ organizationId: VICTIM_ORGANIZATION_ID, tenantId: VICTIM_TENANT_ID }],
						tags: [{ id: 'tag-1' }],
						thirdPartyId: 'github|1',
						defaultOrganizationId: VICTIM_ORGANIZATION_ID,
						hash: '$2b$10$forged'
					}
				})
			);

			for (const field of ['originalUrl', 'organizationId', 'featureAsEmployee', 'id']) {
				expect(result).not.toHaveProperty(field);
			}
			for (const field of [
				'id',
				'roleId',
				'tenantId',
				'organizations',
				'tags',
				'thirdPartyId',
				'defaultOrganizationId',
				'hash',
				'email'
			]) {
				expect(result.user).not.toHaveProperty(field);
			}
			expect(result.user.firstName).toBe('Grace');
		});

		it.each([
			['a missing inviteId', uiBody({ inviteId: undefined })],
			['a non-uuid inviteId', uiBody({ inviteId: 'nope' })],
			['a missing password', uiBody({ password: undefined })],
			['a too-short password', uiBody({ password: 'ab' })],
			['a missing user', uiBody({ user: undefined })],
			['a user array', uiBody({ user: [{ firstName: 'Grace' }] })],
			['a non-string firstName', uiBody({ user: { firstName: { $ne: null } } })],
			['a missing contactOrganization', uiBody({ contactOrganization: undefined })],
			['a scalar contactOrganization', uiBody({ contactOrganization: 'Client Co' })]
		])('rejects %s with a 400', async (_label, body) => {
			await expect(run(body)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('InviteController route binding', () => {
		it('binds POST /contact through a whitelisting validation pipe', () => {
			const pipes =
				Reflect.getMetadata(PIPES_METADATA, InviteController.prototype.acceptOrganizationContactInvite) ?? [];
			const pipe = pipes.find((it: unknown) => it instanceof ValidationPipe) as any;

			expect(pipe).toBeDefined();
			expect(pipe.validatorOptions).toMatchObject({ whitelist: true });
			expect(pipe.isTransformEnabled).toBe(true);
		});

		it('takes originalUrl from the Origin header, not from the body', async () => {
			const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
			const controller = new InviteController({} as any, commandBus as any, {} as any);
			const body = uiBody() as any;

			await controller.acceptOrganizationContactInvite(
				body,
				{ get: (header: string) => (header === 'Origin' ? 'https://app.example' : undefined) } as any,
				'en' as any
			);

			const command = commandBus.execute.mock.calls[0][0];
			expect(command).toBeInstanceOf(InviteAcceptOrganizationContactCommand);
			expect(command.input.originalUrl).toBe('https://app.example');
			expect(body).not.toHaveProperty('originalUrl');
		});
	});

	describe('sanitizeContactOrganization', () => {
		it('removes identity and ownership columns at both levels without mutating its argument', () => {
			const hostile = {
				name: 'Client Co',
				currency: CurrenciesEnum.USD,
				id: VICTIM_ORGANIZATION_ID,
				tenantId: VICTIM_TENANT_ID,
				tenant: { id: VICTIM_TENANT_ID },
				contactId: CONTACT_ID,
				imageId: 'foreign-image',
				createdByUserId: 'someone',
				contact: { id: CONTACT_ID, tenantId: VICTIM_TENANT_ID, city: 'Sofia' }
			} as any;
			const snapshot = JSON.parse(JSON.stringify(hostile));

			const sanitized: any = sanitizeContactOrganization(hostile);

			expect(sanitized).toEqual({ name: 'Client Co', currency: CurrenciesEnum.USD, contact: { city: 'Sofia' } });
			expect(hostile).toEqual(snapshot);
		});

		it('drops a contact that is not a plain object', () => {
			expect(sanitizeContactOrganization({ name: 'Client Co', contact: 'x' } as any)).toEqual({ name: 'Client Co' });
		});
	});

	describe('InviteAcceptOrganizationContactHandler', () => {
		const buildHandler = (invite: Record<string, unknown> | null) => {
			const inviteService = {
				claimInvite: jest.fn().mockResolvedValue(true),
				findOneByIdString: jest.fn().mockResolvedValue(invite),
				releaseInvite: jest.fn().mockResolvedValue(undefined),
				update: jest.fn().mockResolvedValue({ affected: 1 })
			};
			const authService = { register: jest.fn().mockResolvedValue({ id: 'new-user' }) };
			const organizationService = {
				create: jest.fn(async (entity: any) => ({ id: NEW_ORGANIZATION_ID, ...entity }))
			};
			const organizationContactService = { update: jest.fn().mockResolvedValue(undefined) };
			const tenantService = { create: jest.fn().mockResolvedValue({ id: NEW_TENANT_ID, name: 'Client Co' }) };
			const roleService = {
				findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'new-super-admin', name: RolesEnum.SUPER_ADMIN })
			};
			const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };

			const handler = new InviteAcceptOrganizationContactHandler(
				inviteService as any,
				authService as any,
				organizationService as any,
				organizationContactService as any,
				tenantService as any,
				roleService as any,
				commandBus as any
			);

			return {
				handler,
				inviteService,
				authService,
				organizationService,
				organizationContactService,
				tenantService,
				roleService
			};
		};

		const contactInvite = { id: INVITE_ID, email: INVITED_EMAIL, organizationContacts: [{ id: CONTACT_ID }] };

		const hostileCommand = () =>
			new InviteAcceptOrganizationContactCommand(
				{
					inviteId: INVITE_ID,
					password: 'correct-horse',
					originalUrl: 'https://app.example',
					user: { firstName: 'Grace', email: 'attacker@example.com' } as any,
					contactOrganization: {
						name: 'Client Co',
						currency: CurrenciesEnum.USD,
						id: VICTIM_ORGANIZATION_ID,
						tenantId: VICTIM_TENANT_ID,
						contact: { id: CONTACT_ID, city: 'Sofia' }
					} as any
				},
				'en' as any
			);

		it('never hands a body organization id to OrganizationService.create()', async () => {
			const { handler, organizationService } = buildHandler(contactInvite);

			await handler.execute(hostileCommand());

			const [firstCreate] = organizationService.create.mock.calls[0];
			expect(firstCreate).not.toHaveProperty('id');
			expect(firstCreate).not.toHaveProperty('contact');
			expect(firstCreate.tenantId).toBeUndefined();
			expect(firstCreate.tenant).toMatchObject({ id: NEW_TENANT_ID });
			expect(firstCreate.name).toBe('Client Co');

			const [secondCreate] = organizationService.create.mock.calls[1];
			expect(secondCreate.id).toBe(NEW_ORGANIZATION_ID);
			expect(secondCreate.contact).toEqual({ city: 'Sofia', organizationId: NEW_ORGANIZATION_ID, tenantId: NEW_TENANT_ID });
		});

		it('creates the account for the INVITED address, not a body-supplied one', async () => {
			const { handler, authService } = buildHandler(contactInvite);

			await handler.execute(hostileCommand());

			const [input] = authService.register.mock.calls[0];
			expect(input.user.email).toBe(INVITED_EMAIL);
			expect(input.user.role).toMatchObject({ name: RolesEnum.SUPER_ADMIN });
			expect(input.user.tenant).toMatchObject({ id: NEW_TENANT_ID });
			expect(input.inviteId).toBe(INVITE_ID);
		});

		it('still links the invite’s organization contact to the new organization', async () => {
			const { handler, organizationContactService } = buildHandler(contactInvite);

			await handler.execute(hostileCommand());

			expect(organizationContactService.update).toHaveBeenCalledWith(
				CONTACT_ID,
				expect.objectContaining({ organization: expect.objectContaining({ id: NEW_ORGANIZATION_ID }) })
			);
		});

		it('provisions nothing when the claimed invite is not an organization-contact invite', async () => {
			const { handler, tenantService, authService } = buildHandler({ id: INVITE_ID, organizationContacts: [] });

			await expect(handler.execute(hostileCommand())).rejects.toMatchObject({ status: 400 });
			expect(tenantService.create).not.toHaveBeenCalled();
			expect(authService.register).not.toHaveBeenCalled();
		});

		it('hands the claim back when the invite is refused before anything was provisioned', async () => {
			const { handler, inviteService } = buildHandler({ id: INVITE_ID, organizationContacts: [] });

			await expect(handler.execute(hostileCommand())).rejects.toMatchObject({ status: 400 });
			expect(inviteService.claimInvite).toHaveBeenCalledWith(INVITE_ID);
			expect(inviteService.releaseInvite).toHaveBeenCalledWith(INVITE_ID);
			expect(inviteService.update).not.toHaveBeenCalled();
		});

		it('keeps the claim once provisioning has started, so a retry cannot build a second tenant', async () => {
			const { handler, inviteService, roleService } = buildHandler(contactInvite);
			roleService.findOneByWhereOptions.mockRejectedValue(new Error('role lookup failed'));

			await expect(handler.execute(hostileCommand())).rejects.toThrow('role lookup failed');
			expect(inviteService.releaseInvite).not.toHaveBeenCalled();
		});
	});
});
