/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before anything applies `@IsEmployeeBelongsToOrganization()`. See the note
 * in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { AuthService } from './auth.service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const INVITE_ID = '33333333-3333-4333-8333-333333333333';
const VICTIM_EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444';
const NEW_USER_ID = '55555555-5555-4555-8555-555555555555';

/**
 * The Employee columns `repository.create()` would copy off a plain object. TypeORM's
 * `PlainObjectToNewEntityTransformer` walks `metadata.nonVirtualColumns` and copies every value that
 * is not `undefined` — **including the primary key** — which is the whole mechanism behind the
 * employee-row hijack, so the double has to reproduce it rather than pretend `create()` cleans the
 * payload for you.
 */
const EMPLOYEE_COLUMNS = [
	'id',
	'userId',
	'tenantId',
	'organizationId',
	'createdByUserId',
	'isActive',
	'isArchived',
	'billRateValue',
	'allowManualTime',
	'allowModifyTime',
	'allowDeleteTime',
	'isTrackingEnabled',
	'startedWorkOn'
];

class FakeEmployeeRepository {
	readonly created: any[] = [];
	readonly saved: any[] = [];

	create(plain: Record<string, any>): any {
		const entity: Record<string, any> = {};
		for (const column of EMPLOYEE_COLUMNS) {
			if (plain?.[column] !== undefined) {
				entity[column] = plain[column];
			}
		}
		// Relations are assigned as objects, exactly like the real transformer does.
		for (const relation of ['user', 'tenant', 'organization']) {
			if (plain?.[relation] !== undefined) {
				entity[relation] = plain[relation];
			}
		}
		this.created.push(entity);
		return entity;
	}

	async save(entity: any): Promise<any> {
		this.saved.push(entity);
		return entity;
	}
}

const buildService = () => {
	const employeeRepository = new FakeEmployeeRepository();
	const userRows: any[] = [];

	const service: any = Object.create(AuthService.prototype);
	// `register()` reads the ORM switch off the instance; it is set by the constructor we skipped.
	service.ormType = MultiORMEnum.TypeORM;
	service.typeOrmUserRepository = {
		create: jest.fn((plain: any) => ({ ...plain })),
		save: jest.fn(async (entity: any) => {
			const row = { ...entity, id: NEW_USER_ID };
			userRows.push(row);
			return row;
		}),
		update: jest.fn().mockResolvedValue(undefined),
		findOne: jest.fn(async () => ({ id: NEW_USER_ID, emailVerifiedAt: new Date() })),
		metadata: { tableName: 'user' }
	};
	service.typeOrmEmployeeRepository = employeeRepository;
	service.passwordHashService = { hash: jest.fn(async () => '$2b$10$server-side') };
	service.userOrganizationService = { addUserToOrganization: jest.fn().mockResolvedValue(undefined) };
	service.emailConfirmationService = { sendEmailVerification: jest.fn() };
	service.emailService = { welcomeUser: jest.fn() };
	service.eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
	service.termsAcceptanceService = {
		assertClaimsArePublished: jest.fn(),
		record: jest.fn().mockResolvedValue(undefined)
	};
	service.commandBus = { execute: jest.fn() };
	service.userService = { findOneByIdString: jest.fn() };
	service.logger = { error: jest.fn(), warn: jest.fn() };

	return { service: service as AuthService, employeeRepository, userRows };
};

const registrationInput = (overrides: Record<string, unknown> = {}) =>
	({
		user: { firstName: 'Ada', email: 'invitee@example.com', tenant: { id: TENANT_ID } },
		password: 'correct-horse',
		organizationId: ORGANIZATION_ID,
		...overrides
	}) as any;

describe('AuthService.register never updates an employee row it did not create (GHSA-929w-5p4w-cxjp residual)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue(null as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: the pre-fix payload shape hands the victim’s primary key straight to save()', () => {
		const { employeeRepository, service } = buildService();
		const input = registrationInput({ featureAsEmployee: true, id: VICTIM_EMPLOYEE_ID, inviteId: INVITE_ID });

		// `create({ ...input, user, tenantId, tenant, organizationId, organization })` — what the
		// employee branch used to do. `save()` on an entity carrying an id is an UPDATE.
		const entity = (employeeRepository as any).create({
			...input,
			user: { id: NEW_USER_ID },
			tenantId: TENANT_ID,
			tenant: { id: TENANT_ID },
			organizationId: ORGANIZATION_ID,
			organization: { id: ORGANIZATION_ID }
		});

		expect(entity.id).toBe(VICTIM_EMPLOYEE_ID);
		expect(service).toBeDefined();
	});

	it('ignores a body-supplied employee id: nothing is written to the victim’s row', async () => {
		const { service, employeeRepository } = buildService();

		await service.register(
			registrationInput({ featureAsEmployee: true, id: VICTIM_EMPLOYEE_ID }),
			LanguagesEnum.ENGLISH
		);

		expect(employeeRepository.saved).toHaveLength(1);
		expect(employeeRepository.saved[0]).not.toHaveProperty('id');
		expect(employeeRepository.saved[0].user).toMatchObject({ id: NEW_USER_ID });
		expect(employeeRepository.saved[0].tenantId).toBe(TENANT_ID);
	});

	it('ignores attacker-chosen employee profile flags', async () => {
		const { service, employeeRepository } = buildService();

		await service.register(
			registrationInput({
				featureAsEmployee: true,
				allowManualTime: true,
				allowModifyTime: true,
				allowDeleteTime: true,
				isTrackingEnabled: false,
				billRateValue: 9999
			}),
			LanguagesEnum.ENGLISH
		);

		const saved = employeeRepository.saved[0];
		for (const field of [
			'allowManualTime',
			'allowModifyTime',
			'allowDeleteTime',
			'isTrackingEnabled',
			'billRateValue'
		]) {
			expect(saved).not.toHaveProperty(field);
		}
	});

	it('does not mint an employee at all on an invite-accept registration', async () => {
		const { service, employeeRepository } = buildService();

		// The invite sub-handlers create the employee/candidate row themselves, from the invitation;
		// `featureAsEmployee` on an invite body is purely an attacker's field.
		await service.register(
			registrationInput({ featureAsEmployee: true, inviteId: INVITE_ID }),
			LanguagesEnum.ENGLISH
		);

		expect(employeeRepository.created).toHaveLength(0);
		expect(employeeRepository.saved).toHaveLength(0);
	});

	it('refuses outright if an id ever reaches the entity about to be saved', async () => {
		const { service, employeeRepository } = buildService();
		// Simulate any future path that lets a primary key back into the payload.
		jest.spyOn(employeeRepository, 'create').mockReturnValue({ id: VICTIM_EMPLOYEE_ID } as any);

		await expect(
			service.register(registrationInput({ featureAsEmployee: true }), LanguagesEnum.ENGLISH)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(employeeRepository.saved).toHaveLength(0);
	});

	it('still creates the employee for a legitimate featureAsEmployee registration', async () => {
		const { service, employeeRepository } = buildService();

		await service.register(registrationInput({ featureAsEmployee: true }), LanguagesEnum.ENGLISH);

		expect(employeeRepository.saved).toHaveLength(1);
		expect(employeeRepository.saved[0]).toMatchObject({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID
		});
	});

	it('creates no employee when featureAsEmployee is absent', async () => {
		const { service, employeeRepository } = buildService();

		await service.register(registrationInput(), LanguagesEnum.ENGLISH);

		expect(employeeRepository.created).toHaveLength(0);
	});

	it('still refuses a body-supplied user id, hash and verification columns (regression pin)', async () => {
		const { service, userRows } = buildService();

		await service.register(
			registrationInput({
				user: {
					firstName: 'Ada',
					email: 'invitee@example.com',
					tenant: { id: TENANT_ID },
					id: 'someone-elses-user-id',
					hash: '$2b$10$forged',
					emailVerifiedAt: new Date('2020-01-01'),
					emailToken: 'forged',
					code: '000000',
					codeExpireAt: new Date('2030-01-01'),
					refreshToken: 'forged'
				}
			}),
			LanguagesEnum.ENGLISH
		);

		const persisted = userRows[0];
		expect(persisted.hash).toBe('$2b$10$server-side');
		for (const field of ['emailVerifiedAt', 'emailToken', 'code', 'codeExpireAt', 'refreshToken']) {
			expect(persisted[field]).toBeUndefined();
		}
	});
});
