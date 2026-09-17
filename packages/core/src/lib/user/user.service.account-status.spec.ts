// Only the shape of UserService is needed here. Importing it for real pulls in the employee/task
// services and the User entity, which drag the whole core entity graph in and hit the pre-existing
// circular import between `core/entities/internal` and the custom validators. Same technique as
// role-authorization.service.spec.ts.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { UserService } from './user.service';

/**
 * GHSA-3cgp-wmrg-4fqg — `checkIfExists` / `checkIfExistsThirdParty` are reached only from
 * `AuthService.isAuthenticated`, which backs the `@Public()` `GET /auth/authenticated` route. That is the
 * call the web and desktop clients make to decide whether a stored session is still good.
 *
 * `JwtStrategy.validate()` now refuses a deactivated or archived account on every request, so without the
 * same predicate here the two answers disagree: `/auth/authenticated` keeps replying `true` while every
 * other endpoint replies 401, and the client parks a revoked user inside the application shell.
 */
describe('UserService account-status lookups', () => {
	/**
	 * Builds a UserService without running its constructor: `checkIfExists` only touches `ormType` and
	 * the two repositories, and the real constructor drags in the employee/task/password services.
	 */
	function build() {
		const typeOrmRepository = { findOneBy: jest.fn(async (_where: any): Promise<any> => null) };
		const mikroOrmRepository = { findOne: jest.fn(async (_where: any): Promise<any> => null) };

		const service: UserService = Object.create(UserService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmRepository,
			mikroOrmRepository
		});

		return { service, typeOrmRepository };
	}

	describe('checkIfExists', () => {
		it('only counts a user who is active and not archived', async () => {
			const { service, typeOrmRepository } = build();

			await service.checkIfExists('user-1');

			expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
				id: 'user-1',
				isActive: true,
				isArchived: false
			});
		});

		it('reports a deactivated user as not existing', async () => {
			const { service, typeOrmRepository } = build();
			// The row is there, but the account-status predicate excludes it, so the repository finds nothing.
			typeOrmRepository.findOneBy.mockImplementation(async (where: any) =>
				where.isActive === true && where.isArchived === false ? null : ({ id: 'user-1' } as any)
			);

			await expect(service.checkIfExists('user-1')).resolves.toBe(false);
		});

		it('still short-circuits an empty id without querying', async () => {
			const { service, typeOrmRepository } = build();

			await expect(service.checkIfExists(undefined as unknown as string)).resolves.toBe(false);
			expect(typeOrmRepository.findOneBy).not.toHaveBeenCalled();
		});
	});

	describe('checkIfExistsThirdParty', () => {
		it('only counts a third-party user who is active and not archived', async () => {
			const { service, typeOrmRepository } = build();

			await service.checkIfExistsThirdParty('third-party-1');

			expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
				thirdPartyId: 'third-party-1',
				isActive: true,
				isArchived: false
			});
		});

		it('still short-circuits an empty third party id without querying', async () => {
			const { service, typeOrmRepository } = build();

			await expect(service.checkIfExistsThirdParty(undefined as unknown as string)).resolves.toBe(false);
			expect(typeOrmRepository.findOneBy).not.toHaveBeenCalled();
		});
	});
});
