// Only the shape of UserService is needed here. Importing it for real pulls in the employee/task
// services and the User entity, which drag the whole core entity graph in and hit the pre-existing
// circular import between `core/entities/internal` and the custom validators. Same technique as
// user.service.role-forms.spec.ts.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import 'reflect-metadata';
import { Column, DataSource, Entity, PrimaryColumn, Repository } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { UserService } from './user.service';
import { UserEmailChangedEvent } from './events/user-email-changed.event';
import { isEmailAddressChange, normalizeEmailAddress } from './email-change.util';

/**
 * Mirrors the e-mail and confirmation columns of `User` as TypeORM maps them: the confirmation
 * columns are nullable and `insert: false` (they are only ever written by an UPDATE), exactly like
 * `@MultiORMColumn({ insert: false, nullable: true })` on the real entity. Saving goes through a
 * real better-sqlite3 database, so the assertions are about what TypeORM actually stores.
 */
@Entity('email_change_user')
class FixtureUser {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar', { nullable: true })
	email: string;

	@Column('varchar', { nullable: true })
	firstName?: string;

	@Column({ type: 'datetime', insert: false, nullable: true })
	emailVerifiedAt?: Date | null;

	@Column({ type: 'varchar', insert: false, nullable: true })
	emailToken?: string | null;

	@Column({ type: 'varchar', insert: false, nullable: true })
	code?: string | null;

	@Column({ type: 'datetime', insert: false, nullable: true })
	codeExpireAt?: Date | null;
}

describe('UserService.updateProfile — changing the e-mail address resets its confirmation', () => {
	const TENANT = 'tenant-1';
	const EMP = '44444444-4444-4444-8444-444444444444';
	const SELF = 'user-self';
	const OTHER = 'user-other';
	const VERIFIED_AT = new Date('2026-01-15T10:00:00.000Z');
	const CODE_EXPIRY = new Date('2099-01-01T00:00:00.000Z');

	let dataSource: DataSource;
	let users: Repository<FixtureUser>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [FixtureUser],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		users = dataSource.getRepository(FixtureUser);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	/** A confirmed account at `ada@example.com` that also holds a pending confirmation link and code. */
	async function seed(id: string) {
		await users.delete({ id });
		await users.insert({ id, email: 'ada@example.com', firstName: 'Ada' });
		await users.update(
			{ id },
			{ emailVerifiedAt: VERIFIED_AT, emailToken: 'hashed-token', code: 'ABCD1234', codeExpireAt: CODE_EXPIRY }
		);
	}

	const stored = (id: string) => users.findOneByOrFail({ id });

	function build(caller: { userId: string; permissions: PermissionsEnum[] }, { eventBus = true } = {}) {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(caller.userId);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(EMP);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			caller.permissions.includes(permission)
		);

		const publish = jest.fn();
		const service: UserService = Object.create(UserService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			// The row as `findOneByIdString(id, { relations: { role: true } })` returns it.
			findOneByIdString: jest.fn(async (id: string) => ({
				...(await stored(id)),
				role: { id: EMP, name: RolesEnum.EMPLOYEE }
			})),
			findOneByWhereOptions: jest.fn(async (where: any) => stored(where.id)),
			// `CrudService.save` on TypeORM is `typeOrmRepository.save(entity)`.
			save: jest.fn(async (entity: any) => users.save(entity)),
			_eventBus: eventBus ? { publish } : undefined
		});
		return { service, publish };
	}

	const employee = { userId: SELF, permissions: [PermissionsEnum.PROFILE_EDIT] };
	const admin = { userId: SELF, permissions: [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_USERS_EDIT] };

	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: a plain save of a new address keeps the old confirmation (the pre-fix write)', async () => {
		await seed(SELF);

		await users.save({ id: SELF, email: 'someone-else@example.com' });

		const row = await stored(SELF);
		expect(row.email).toBe('someone-else@example.com');
		expect(row.emailVerifiedAt).toEqual(VERIFIED_AT);
		expect(row.code).toBe('ABCD1234');
	});

	it('clears the confirmation and any pending link/code when a user changes their own address', async () => {
		await seed(SELF);
		const { service, publish } = build(employee);

		const result = await service.updateProfile(SELF, { email: 'new@example.com' } as any);

		const row = await stored(SELF);
		expect(row.email).toBe('new@example.com');
		expect(row.emailVerifiedAt).toBeNull();
		expect(row.emailToken).toBeNull();
		expect(row.code).toBeNull();
		expect(row.codeExpireAt).toBeNull();
		expect(result.emailVerifiedAt).toBeNull();

		// The confirmation e-mail for the new address is requested once, for the updated user.
		expect(publish).toHaveBeenCalledTimes(1);
		const event = publish.mock.calls[0][0];
		expect(event).toBeInstanceOf(UserEmailChangedEvent);
		expect(event.user).toEqual(expect.objectContaining({ id: SELF, email: 'new@example.com' }));
	});

	it('clears the confirmation when an administrator changes another user’s address', async () => {
		await seed(OTHER);
		const { service, publish } = build(admin);

		await service.updateProfile(OTHER, { email: 'other-new@example.com' } as any);

		const row = await stored(OTHER);
		expect(row.email).toBe('other-new@example.com');
		expect(row.emailVerifiedAt).toBeNull();
		expect(publish).toHaveBeenCalledTimes(1);
		expect(publish.mock.calls[0][0].user.id).toBe(OTHER);
	});

	it('does not let a confirmation timestamp in the same body survive an address change', async () => {
		await seed(SELF);
		const { service } = build(employee);

		await service.updateProfile(SELF, {
			email: 'new@example.com',
			emailVerifiedAt: new Date(),
			code: 'ZZZZ9999'
		} as any);

		const row = await stored(SELF);
		expect(row.emailVerifiedAt).toBeNull();
		expect(row.code).toBeNull();
	});

	it.each([
		['the same address', 'ada@example.com'],
		['the same address in a different case', 'ADA@Example.COM'],
		['the same address with surrounding whitespace', '  ada@example.com  ']
	])('keeps the confirmation when the body carries %s', async (_label, email) => {
		await seed(SELF);
		const { service, publish } = build(employee);

		await service.updateProfile(SELF, { email, firstName: 'Ada L.' } as any);

		const row = await stored(SELF);
		expect(row.firstName).toBe('Ada L.');
		expect(row.emailVerifiedAt).toEqual(VERIFIED_AT);
		expect(row.emailToken).toBe('hashed-token');
		expect(row.code).toBe('ABCD1234');
		expect(publish).not.toHaveBeenCalled();
	});

	it('keeps the confirmation when the body does not touch the address', async () => {
		await seed(SELF);
		const { service, publish } = build(employee);

		await service.updateProfile(SELF, { firstName: 'Augusta' } as any);

		const row = await stored(SELF);
		expect(row.firstName).toBe('Augusta');
		expect(row.email).toBe('ada@example.com');
		expect(row.emailVerifiedAt).toEqual(VERIFIED_AT);
		expect(publish).not.toHaveBeenCalled();
	});

	it('still saves the change (unconfirmed) when no event bus is available', async () => {
		await seed(SELF);
		const { service } = build(employee, { eventBus: false });

		await service.updateProfile(SELF, { email: 'new@example.com' } as any);

		const row = await stored(SELF);
		expect(row.email).toBe('new@example.com');
		expect(row.emailVerifiedAt).toBeNull();
	});

	it('does not fail the update when requesting the confirmation e-mail throws', async () => {
		await seed(SELF);
		const { service, publish } = build(employee);
		publish.mockImplementation(() => {
			throw new Error('bus down');
		});

		await expect(service.updateProfile(SELF, { email: 'new@example.com' } as any)).resolves.toEqual(
			expect.objectContaining({ email: 'new@example.com', emailVerifiedAt: null })
		);
	});
});

describe('email-change.util', () => {
	it('normalizes by trimming and case-folding', () => {
		expect(normalizeEmailAddress('  Ada@Example.COM ')).toBe('ada@example.com');
		expect(normalizeEmailAddress(null)).toBe('');
		expect(normalizeEmailAddress(undefined)).toBe('');
	});

	it.each([
		['ada@example.com', undefined, false],
		['ada@example.com', 'ada@example.com', false],
		['ada@example.com', ' ADA@example.com ', false],
		['ada@example.com', 'ada@example.org', true],
		['ada@example.com', 'ada+billing@example.com', true],
		['ada@example.com', null, true],
		['ada@example.com', '', true],
		[null, 'ada@example.com', true]
	])('isEmailAddressChange(%p, %p) is %p', (current, requested, expected) => {
		expect(isEmailAddressChange(current as any, requested as any)).toBe(expected);
	});
});
