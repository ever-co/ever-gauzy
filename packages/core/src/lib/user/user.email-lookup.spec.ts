/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`.
 */
import '../core/entities/internal';
import { IUser } from '@gauzy/contracts';
import { MultiORMEnum } from '../core/utils';
import { RequestContext } from '../core/context';
import { UserService } from './user.service';
import { UserController } from './user.controller';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const TENANT_A_USER = {
	id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	email: 'colleague@tenant-a.example',
	tenantId: TENANT_A,
	firstName: 'Alice'
};

const TENANT_B_USER = {
	id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
	email: 'victim@tenant-b.example',
	tenantId: TENANT_B,
	firstName: 'Bob'
};

/**
 * Stand-in for the TypeORM user repository that reproduces the one semantic that matters here:
 * a criteria key whose value is `undefined` is DROPPED from the query (see
 * TYPEORM_NULL_WHERE_ISOLATION). That is what makes a forgotten tenant silently widen a lookup, so
 * the double has to model it rather than treat `undefined` as "matches nothing".
 */
class FakeUserRepository {
	readonly queries: Array<Record<string, unknown>> = [];

	constructor(private readonly rows: Array<Record<string, unknown>>) {}

	async findOneBy(where: Record<string, unknown>): Promise<any> {
		this.queries.push({ ...where });
		const predicates = Object.entries(where).filter(([, value]) => value !== undefined);
		return this.rows.find((row) => predicates.every(([key, value]) => row[key] === value)) ?? null;
	}
}

const buildService = (): { service: UserService; repository: FakeUserRepository } => {
	const repository = new FakeUserRepository([TENANT_A_USER, TENANT_B_USER]);
	const service = new UserService(repository as any, {} as any, {} as any, {} as any, {} as any);
	// `ormType` is a getter resolved from DB_ORM at module load; pin it so the suite ignores .env.
	Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
	return { service, repository };
};

describe('User lookup by email is tenant scoped (GHSA-6qvm-3wg4-26w4, finding 1)', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('UserService.getUserByEmailInTenant', () => {
		it('finds a user of the caller’s own tenant — the legitimate flow is unchanged', async () => {
			const { service, repository } = buildService();

			const found = await service.getUserByEmailInTenant(TENANT_A_USER.email, TENANT_A);

			expect(found).toEqual(TENANT_A_USER);
			expect(repository.queries).toEqual([{ email: TENANT_A_USER.email, tenantId: TENANT_A }]);
		});

		it('does NOT find a user of another tenant', async () => {
			const { service, repository } = buildService();

			const found = await service.getUserByEmailInTenant(TENANT_B_USER.email, TENANT_A);

			expect(found).toBeNull();
			// The tenant must actually be in the criteria, not merely compared afterwards.
			expect(repository.queries).toEqual([{ email: TENANT_B_USER.email, tenantId: TENANT_A }]);
		});

		it.each([[undefined], [null], ['']])(
			'fails closed on a missing tenant (%p): returns null WITHOUT querying',
			async (tenantId) => {
				const { service, repository } = buildService();

				await expect(service.getUserByEmailInTenant(TENANT_B_USER.email, tenantId as any)).resolves.toBeNull();
				// Had the value been passed through, the `tenantId` key would have been dropped from
				// the where object and the lookup would have widened back to every tenant.
				expect(repository.queries).toEqual([]);
			}
		);

		it('fails closed on a missing email too', async () => {
			const { service, repository } = buildService();

			await expect(service.getUserByEmailInTenant('', TENANT_A)).resolves.toBeNull();
			expect(repository.queries).toEqual([]);
		});

		it('CONTROL: the global lookup still answers across tenants — which is why it may not be used here', async () => {
			const { service } = buildService();

			// `getUserByEmail` is kept for the pre-authentication OAuth / social-signup flows, which
			// have no tenant context. This arm is the shape of the vulnerability: it is exactly what
			// `findByEmail` used to call.
			await expect(service.getUserByEmail(TENANT_B_USER.email)).resolves.toEqual(TENANT_B_USER);
		});
	});

	describe('UserController.findByEmail', () => {
		const buildController = () => {
			const userService = {
				getUserByEmail: jest.fn().mockResolvedValue(TENANT_B_USER),
				getUserByEmailInTenant: jest
					.fn()
					.mockImplementation(
						async (email: string, tenantId: string) =>
							[TENANT_A_USER, TENANT_B_USER].find(
								(row) => row.email === email && row.tenantId === tenantId
							) ?? null
					)
			};
			const controller = new UserController(userService as any, {} as any, {} as any);
			return { controller, userService };
		};

		it('scopes the lookup to the caller’s tenant and never uses the global one', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
			const { controller, userService } = buildController();

			const result = await controller.findByEmail(TENANT_B_USER.email);

			expect(userService.getUserByEmail).not.toHaveBeenCalled();
			expect(userService.getUserByEmailInTenant).toHaveBeenCalledWith(TENANT_B_USER.email, TENANT_A);
			// 200 + null, not 404: the invite-contact form's async validator checks for a falsy body.
			expect(result).toBeNull();
		});

		it('still resolves a same-tenant user, so the "already exists" hint keeps working', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
			const { controller } = buildController();

			const result: IUser = await controller.findByEmail(TENANT_A_USER.email);

			expect(result).toEqual(TENANT_A_USER);
		});

		it('returns null when there is no tenant on the request context', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
			const { controller, userService } = buildController();

			await expect(controller.findByEmail(TENANT_B_USER.email)).resolves.toBeNull();
			expect(userService.getUserByEmailInTenant).toHaveBeenCalledWith(TENANT_B_USER.email, null);
		});
	});
});
