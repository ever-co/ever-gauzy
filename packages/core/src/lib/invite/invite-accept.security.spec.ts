/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies
 * `@IsEmployeeBelongsToOrganization()`. See the note in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { RolesEnum } from '@gauzy/contracts';
import { AcceptInviteDTO } from './dto';
import { InviteController } from './invite.controller';
import { InviteAcceptHandler } from './commands/handlers/invite-accept.handler';
import { InviteAcceptCommand } from './commands/invite-accept.command';
import { InviteAcceptCandidateCommand } from './commands/invite.accept-candidate.command';
import { InviteAcceptEmployeeCommand } from './commands/invite.accept-employee.command';
import { InviteAcceptUserCommand } from './commands/invite.accept-user.command';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const INVITE_ID = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE_ROLE_ID = '44444444-4444-4444-8444-444444444444';
const SUPER_ADMIN_ROLE_ID = '55555555-5555-4555-8555-555555555555';
const VICTIM_EMPLOYEE_ID = '66666666-6666-4666-8666-666666666666';
const INVITED_EMAIL = 'invitee@example.com';

describe('POST /invite/accept cannot carry privileged fields into the sink (GHSA-929w-5p4w-cxjp)', () => {
	describe('AcceptInviteDTO whitelist', () => {
		const pipe = new ValidationPipe({ whitelist: true, transform: true });
		const run = (value: unknown) => pipe.transform(value, { type: 'body', metatype: AcceptInviteDTO } as any);

		it('keeps everything the Angular accept form sends', async () => {
			const result: any = await run({
				user: {
					firstName: 'Ada',
					lastName: 'Lovelace',
					email: INVITED_EMAIL,
					role: { id: EMPLOYEE_ROLE_ID, name: RolesEnum.EMPLOYEE },
					tenant: undefined,
					tags: undefined
				},
				password: 'correct-horse',
				terms: [
					{
						documentId: 'tos:gauzy',
						version: '1.0.0',
						sha256: 'a'.repeat(64),
						locale: 'en'
					}
				],
				token: 'the-emailed-token',
				email: INVITED_EMAIL
			});

			expect(result.email).toBe(INVITED_EMAIL);
			expect(result.token).toBe('the-emailed-token');
			expect(result.password).toBe('correct-horse');
			expect(result.user.firstName).toBe('Ada');
			expect(result.user.lastName).toBe('Lovelace');
			expect(result.terms).toHaveLength(1);
		});

		it('keeps the Ever Teams code variant working without a token', async () => {
			const result: any = await run({
				code: '123456',
				email: INVITED_EMAIL,
				user: { firstName: 'Ada' },
				password: 'correct-horse'
			});

			expect(result.code).toBe('123456');
			expect('token' in result).toBe(false);
		});

		it('strips every field the invitation itself must own', async () => {
			const result: any = await run({
				email: INVITED_EMAIL,
				token: 'the-emailed-token',
				password: 'correct-horse',
				// The employee-row hijack: a top-level primary key plus the employee branch.
				id: VICTIM_EMPLOYEE_ID,
				featureAsEmployee: true,
				organizationId: ORGANIZATION_ID,
				createdByUserId: 'some-super-admin',
				isImporting: true,
				sourceId: 'anything',
				appEmailConfirmationUrl: 'https://attacker.example',
				user: {
					firstName: 'Ada',
					// The original advisory's vector, plus everything found alongside it.
					id: 'another-users-id',
					roleId: SUPER_ADMIN_ROLE_ID,
					role: { id: SUPER_ADMIN_ROLE_ID, name: RolesEnum.SUPER_ADMIN },
					tenantId: 'another-tenant',
					tenant: { id: 'another-tenant' },
					organizations: [{ organizationId: ORGANIZATION_ID, tenantId: TENANT_ID }],
					tags: [{ id: 'tag-1' }],
					thirdPartyId: 'github|1',
					imageId: 'image-1',
					defaultOrganizationId: ORGANIZATION_ID,
					lastOrganizationId: ORGANIZATION_ID,
					defaultTeamId: 'team-1',
					lastTeamId: 'team-1',
					isActive: false,
					isArchived: true,
					hash: '$2b$10$forged',
					emailVerifiedAt: '2020-01-01T00:00:00.000Z',
					emailToken: 'forged',
					code: '000000',
					refreshToken: 'forged'
				}
			});

			for (const field of [
				'id',
				'featureAsEmployee',
				'organizationId',
				'createdByUserId',
				'isImporting',
				'sourceId',
				'appEmailConfirmationUrl'
			]) {
				expect(result).not.toHaveProperty(field);
			}
			for (const field of [
				'id',
				'roleId',
				'role',
				'tenantId',
				'tenant',
				'organizations',
				'tags',
				'thirdPartyId',
				'imageId',
				'defaultOrganizationId',
				'lastOrganizationId',
				'defaultTeamId',
				'lastTeamId',
				'isActive',
				'isArchived',
				'hash',
				'emailVerifiedAt',
				'emailToken',
				'code',
				'refreshToken'
			]) {
				expect(result.user).not.toHaveProperty(field);
			}
			// …and the harmless part survives.
			expect(result.user.firstName).toBe('Ada');
		});

		it('still accepts a user object that carries only server-owned fields (empty once whitelisted)', async () => {
			// Before this route had a pipe such a body was accepted: `InviteAcceptHandler` re-supplies
			// email, role and tenant from the invitation. `@IsNotEmptyObject()` sees the object as
			// class-transformer built it (keys still present) and the nested whitelist only strips
			// afterwards, so the emptied `user` must not — and does not — turn into a 400.
			const result: any = await run({
				code: '123456',
				email: INVITED_EMAIL,
				user: { email: INVITED_EMAIL, role: { name: RolesEnum.EMPLOYEE }, tenant: { id: TENANT_ID } },
				password: 'correct-horse'
			});

			expect(result.user).toEqual({});
		});

		it.each([
			['a user array instead of an object', { email: INVITED_EMAIL, token: 't', user: [{ firstName: 'A' }] }],
			['a scalar user', { email: INVITED_EMAIL, token: 't', user: 'Ada' }],
			['a malformed email', { email: 'not-an-email', token: 't', user: { firstName: 'A' } }],
			['a missing email', { token: 't', user: { firstName: 'A' } }],
			['a missing user object', { email: INVITED_EMAIL, token: 't' }],
			['a too-short password', { email: INVITED_EMAIL, token: 't', user: { firstName: 'A' }, password: 'ab' }],
			[
				'a terms claim with a bogus digest',
				{
					email: INVITED_EMAIL,
					token: 't',
					user: { firstName: 'A' },
					terms: [{ documentId: 'tos:gauzy', version: '1.0.0', sha256: 'nope', locale: 'en' }]
				}
			]
		])('rejects %s', async (_label, body) => {
			await expect(run(body)).rejects.toMatchObject({ status: 400 });
		});

		it.each([
			['firstName', { email: INVITED_EMAIL, token: 't', user: { firstName: { $ne: null } } }],
			['lastName', { email: INVITED_EMAIL, token: 't', user: { lastName: [1, 2] } }]
		])('rejects a non-string %s with a 400, not a 500 from inside the pipe', async (_label, body) => {
			// A `@Transform` runs BEFORE any validator, so a trim that assumes a string turns a
			// malformed field on this @Public() route into a raw TypeError — which leaves the pipe
			// as a 500 with a stack trace instead of a validation error.
			await expect(run(body)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('InviteController route binding', () => {
		it('binds POST /accept through a whitelisting validation pipe', () => {
			// The route is @Public(); without a pipe the raw body reaches `AuthService.register()`,
			// which is what every residual on this advisory depends on. Its `/validate` and
			// `/validate-by-code` siblings have always whitelisted.
			const pipes = Reflect.getMetadata(PIPES_METADATA, InviteController.prototype.acceptInvitation) ?? [];
			const pipe = pipes.find((it: unknown) => it instanceof ValidationPipe) as any;

			expect(pipe).toBeDefined();
			expect(pipe.validatorOptions).toMatchObject({ whitelist: true });
			expect(pipe.isTransformEnabled).toBe(true);
		});
	});

	describe('InviteAcceptHandler', () => {
		const buildHandler = (roleName: RolesEnum) => {
			const invite = {
				id: INVITE_ID,
				email: INVITED_EMAIL,
				tenantId: TENANT_ID,
				tenant: { id: TENANT_ID },
				role: { id: EMPLOYEE_ROLE_ID, name: roleName }
			};
			const inviteService = {
				validateByToken: jest.fn().mockResolvedValue(invite),
				validateByCode: jest.fn().mockResolvedValue(invite),
				findOneByIdString: jest.fn().mockResolvedValue(invite)
			};
			const registeredUser = { id: 'new-user', email: INVITED_EMAIL, isActive: true };
			const commandBus = { execute: jest.fn().mockResolvedValue(registeredUser) };
			const typeOrmUserRepository = { findOneOrFail: jest.fn().mockResolvedValue(registeredUser) };
			const authService = {
				getJwtAccessToken: jest.fn().mockResolvedValue('access'),
				getJwtRefreshToken: jest.fn().mockResolvedValue('refresh')
			};
			const userService = { setCurrentRefreshToken: jest.fn().mockResolvedValue(undefined) };
			const employeeService = { findOneByUserId: jest.fn().mockResolvedValue(null) };

			const handler = new InviteAcceptHandler(
				typeOrmUserRepository as any,
				commandBus as any,
				inviteService as any,
				authService as any,
				userService as any,
				employeeService as any
			);

			return { handler, commandBus, inviteService };
		};

		const hostileInput = (overrides: Record<string, unknown> = {}) =>
			({
				email: INVITED_EMAIL,
				token: 'the-emailed-token',
				password: 'correct-horse',
				id: VICTIM_EMPLOYEE_ID,
				featureAsEmployee: true,
				organizationId: ORGANIZATION_ID,
				createdByUserId: 'some-super-admin',
				isImporting: true,
				sourceId: 'anything',
				user: { firstName: 'Ada', roleId: SUPER_ADMIN_ROLE_ID },
				...overrides
			}) as any;

		it('deletes the sink-privileged top-level fields before dispatching', async () => {
			const { handler, commandBus } = buildHandler(RolesEnum.EMPLOYEE);

			await handler.execute(new InviteAcceptCommand(hostileInput(), 'en' as any));

			const dispatched = commandBus.execute.mock.calls[0][0];
			expect(dispatched).toBeInstanceOf(InviteAcceptEmployeeCommand);
			for (const field of ['id', 'featureAsEmployee', 'createdByUserId', 'isImporting', 'sourceId']) {
				expect(dispatched.input).not.toHaveProperty(field);
			}
			// `organizationId` is re-derived from the invitation by each sub-handler.
			expect(dispatched.input.organizationId).toBeUndefined();
		});

		it('still pins role, roleId, email and tenant from the invitation', async () => {
			const { handler, commandBus } = buildHandler(RolesEnum.EMPLOYEE);

			await handler.execute(new InviteAcceptCommand(hostileInput(), 'en' as any));

			const { input } = commandBus.execute.mock.calls[0][0];
			expect(input.user.roleId).toBe(EMPLOYEE_ROLE_ID);
			expect(input.user.role).toMatchObject({ id: EMPLOYEE_ROLE_ID });
			expect(input.user.email).toBe(INVITED_EMAIL);
			expect(input.user.tenantId).toBe(TENANT_ID);
			expect(input.inviteId).toBe(INVITE_ID);
		});

		it('works on a copy and leaves the command input it was handed untouched', async () => {
			const { handler, commandBus } = buildHandler(RolesEnum.EMPLOYEE);
			const input = hostileInput();
			const snapshot = JSON.parse(JSON.stringify(input));

			await handler.execute(new InviteAcceptCommand(input, 'en' as any));

			expect(input).toEqual(snapshot);
			// …while the dispatched copy is still the pinned, stripped one.
			const dispatched = commandBus.execute.mock.calls[0][0].input;
			expect(dispatched).not.toBe(input);
			expect(dispatched).not.toHaveProperty('id');
			expect(dispatched.user.roleId).toBe(EMPLOYEE_ROLE_ID);
		});

		it.each([
			[RolesEnum.EMPLOYEE, InviteAcceptEmployeeCommand],
			[RolesEnum.CANDIDATE, InviteAcceptCandidateCommand],
			[RolesEnum.VIEWER, InviteAcceptUserCommand]
		])('still routes a %s invitation to its own sub-handler', async (roleName, expected) => {
			const { handler, commandBus } = buildHandler(roleName as RolesEnum);

			await expect(handler.execute(new InviteAcceptCommand(hostileInput(), 'en' as any))).resolves.toMatchObject({
				token: 'access',
				refresh_token: 'refresh'
			});

			expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(expected as any);
		});

		it('validates by token when a token is present', async () => {
			const { handler, inviteService } = buildHandler(RolesEnum.EMPLOYEE);

			await handler.execute(new InviteAcceptCommand(hostileInput(), 'en' as any));

			expect(inviteService.validateByToken).toHaveBeenCalledWith({
				email: INVITED_EMAIL,
				token: 'the-emailed-token'
			});
			expect(inviteService.validateByCode).not.toHaveBeenCalled();
		});

		it('validates by code when only a code is present, even if the DTO declares `token`', async () => {
			const { handler, inviteService } = buildHandler(RolesEnum.EMPLOYEE);

			// This is the shape a transformed DTO produces for the Ever Teams flow: the class knows
			// about `token`, the payload does not carry one.
			const input = hostileInput({ token: undefined, code: '123456' });

			await handler.execute(new InviteAcceptCommand(input, 'en' as any));

			expect(inviteService.validateByCode).toHaveBeenCalledWith({ email: INVITED_EMAIL, code: '123456' });
			expect(inviteService.validateByToken).not.toHaveBeenCalled();
		});

		it('refuses an acceptance carrying neither a token nor a code', async () => {
			const { handler, commandBus } = buildHandler(RolesEnum.EMPLOYEE);

			await expect(
				handler.execute(
					new InviteAcceptCommand(hostileInput({ token: undefined, code: undefined }), 'en' as any)
				)
			).rejects.toThrow();
			expect(commandBus.execute).not.toHaveBeenCalled();
		});
	});
});
