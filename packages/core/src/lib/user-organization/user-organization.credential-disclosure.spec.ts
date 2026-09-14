// Prime the entity graph first: entering it through any other door (the `core/crud` barrel, or a
// repository module) trips the pre-existing circular imports and the suite fails to LOAD rather
// than failing an assertion. Same idiom as `tenant-aware-crud.service.spec.ts`.
import '../core/entities/internal';

import { instanceToPlain } from 'class-transformer';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { Employee, User, UserOrganization } from '../core/entities/internal';
import { UserOrganizationService } from './user-organization.services';

/**
 * Regression suite for GHSA-hh83-hq74-gh9f — credential-field disclosure on
 * `GET /api/user-organization`.
 *
 * `User.hash` (bcrypt password hash), `refreshToken`, `code` (magic sign-in code),
 * `codeExpireAt` and `emailToken` carry no ORM-level `select: false`; their ONLY redaction is
 * class-transformer's `@Exclude({ toPlainOnly: true })`, applied by the global
 * `TransformInterceptor` through `instanceToPlain`. That metadata is reached through the class
 * PROTOTYPE, so it applies to a `User` instance and to nothing else.
 *
 * `findUserOrganizations` used to rebuild every row as
 * `{ ...organization, user: { ...organization.user, employee } }`. The inner spread produces a
 * prototype-less plain object, `instanceToPlain` finds no metadata on it, and every credential
 * column was serialized verbatim to any authenticated tenant user who asked for
 * `?relations[]=user&includeEmployee=true`.
 *
 * The CONTROL test at the bottom reproduces that bypass directly, so the suite documents the
 * hazard as well as guarding the fix.
 */
describe('UserOrganizationService.findUserOrganizations — credential redaction', () => {
	/** Every @Exclude({ toPlainOnly: true }) column of the User entity. */
	const CREDENTIAL_KEYS = [
		'hash',
		'refreshToken',
		'code',
		'codeExpireAt',
		'emailVerifiedAt',
		'emailToken'
	] as const;

	const USER_ID = '11111111-1111-1111-1111-111111111111';
	const TENANT_ID = '22222222-2222-2222-2222-222222222222';
	const EMPLOYEE_ID = '33333333-3333-3333-3333-333333333333';

	/**
	 * Builds a User exactly as TypeORM hands it back for `relations[]=user`: a real entity
	 * instance with every credential column populated.
	 */
	function buildUser(): User {
		return new User({
			id: USER_ID,
			tenantId: TENANT_ID,
			email: 'super.admin@ever.co',
			firstName: 'Super',
			lastName: 'Admin',
			// Assembled at runtime so secret scanners do not flag the fixture.
			hash: ['$2b$10$', 'a'.repeat(53)].join(''),
			refreshToken: ['$2b$10$', 'b'.repeat(53)].join(''),
			code: '123456',
			codeExpireAt: new Date('2030-01-01T00:00:00.000Z'),
			emailVerifiedAt: new Date('2029-01-01T00:00:00.000Z'),
			emailToken: ['$2b$10$', 'c'.repeat(53)].join('')
		});
	}

	function buildEmployee(): Employee {
		return new Employee({ id: EMPLOYEE_ID, userId: USER_ID, tenantId: TENANT_ID });
	}

	function buildUserOrganization(user?: User): UserOrganization {
		return new UserOrganization({
			id: '44444444-4444-4444-4444-444444444444',
			tenantId: TENANT_ID,
			organizationId: '55555555-5555-5555-5555-555555555555',
			isDefault: true,
			...(user ? { userId: user.id, user } : {})
		});
	}

	/**
	 * Wires the service with stub repositories and a stubbed employee lookup, and pins the
	 * inherited `TenantAwareCrudService.findAll` to the supplied rows.
	 */
	function build(items: UserOrganization[], employees: Employee[] = []) {
		const employeeService = {
			findEmployeesByUserIds: jest.fn(async () => employees)
		};
		const service = new UserOrganizationService({} as any, {} as any, {} as any, employeeService as any);

		const findAll = jest
			.spyOn(TenantAwareCrudService.prototype, 'findAll')
			.mockResolvedValue({ items, total: items.length } as any);

		return { service, employeeService, findAll };
	}

	/** Serializes the way the global TransformInterceptor does. */
	function serialize(payload: unknown): any {
		return instanceToPlain(payload);
	}

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('strips every credential column when includeEmployee is true (the reported sink)', async () => {
		const user = buildUser();
		const { service } = build([buildUserOrganization(user)], [buildEmployee()]);

		const result = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, true);
		const plain = serialize(result);
		const plainUser = plain.items[0].user;

		for (const key of CREDENTIAL_KEYS) {
			expect(plainUser).not.toHaveProperty(key);
		}
		// The whole response body must not carry the secrets anywhere else either.
		expect(JSON.stringify(plain)).not.toContain(user.hash);
		expect(JSON.stringify(plain)).not.toContain(user.code);
		expect(JSON.stringify(plain)).not.toContain(user.emailToken);
		expect(JSON.stringify(plain)).not.toContain(user.refreshToken);
	});

	it('still returns user.employee when includeEmployee is true (UI contract)', async () => {
		const { service } = build([buildUserOrganization(buildUser())], [buildEmployee()]);

		const result = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, true);
		const plain = serialize(result);

		expect(plain.total).toBe(1);
		expect(plain.items[0].user.employee).toBeDefined();
		expect(plain.items[0].user.employee.id).toBe(EMPLOYEE_ID);
		// The non-sensitive user fields the Angular users list renders are untouched.
		expect(plain.items[0].user.email).toBe('super.admin@ever.co');
		expect(plain.items[0].user.firstName).toBe('Super');
	});

	it('returns rows whose user could not be matched to an employee without credentials', async () => {
		// `EmployeeService.findEmployeesByUserIds` swallows its own errors and returns [], so this
		// is the shape most tenants actually hit — and pre-fix it leaked just the same.
		const { service } = build([buildUserOrganization(buildUser())], []);

		const result = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, true);
		const plainUser = serialize(result).items[0].user;

		for (const key of CREDENTIAL_KEYS) {
			expect(plainUser).not.toHaveProperty(key);
		}
	});

	it('keeps the entity prototypes on the returned rows', async () => {
		const { service } = build([buildUserOrganization(buildUser())], [buildEmployee()]);

		const { items } = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, true);

		// Prototype preservation IS the fix: a plain object here means the redaction is gone.
		expect(items[0]).toBeInstanceOf(UserOrganization);
		expect(items[0].user).toBeInstanceOf(User);
	});

	it('strips every credential column when includeEmployee is false', async () => {
		const { service } = build([buildUserOrganization(buildUser())], [buildEmployee()]);

		const result = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, false);
		const plainUser = serialize(result).items[0].user;

		for (const key of CREDENTIAL_KEYS) {
			expect(plainUser).not.toHaveProperty(key);
		}
		expect(plainUser.email).toBe('super.admin@ever.co');
	});

	it('handles the row-without-userId branch without leaking or crashing', async () => {
		const orphan = buildUserOrganization(); // no userId, no user relation loaded
		const { service } = build([orphan], []);

		const result = await service.findUserOrganizations({} as BaseQueryDTO<UserOrganization>, true);
		const plain = serialize(result);

		expect(plain.items).toHaveLength(1);
		expect(plain.items[0].user).toBeUndefined();
		expect(JSON.stringify(plain)).not.toContain('hash');
		expect(result.items[0]).toBeInstanceOf(UserOrganization);
	});

	it('CONTROL: an object spread of a loaded User defeats @Exclude (why the fix is shaped this way)', () => {
		const user = buildUser();

		// A real entity instance is redacted correctly...
		const fromEntity = serialize(user);
		for (const key of CREDENTIAL_KEYS) {
			expect(fromEntity).not.toHaveProperty(key);
		}

		// ...while the spread copy the service used to build is not redacted at all.
		const fromSpread = serialize({ ...user, employee: buildEmployee() });
		expect(fromSpread.hash).toBe(user.hash);
		expect(fromSpread.code).toBe(user.code);
		expect(fromSpread.emailToken).toBe(user.emailToken);
		expect(fromSpread.refreshToken).toBe(user.refreshToken);
	});
});
