// Same isolation as user.service.account-status.spec.ts: only UserService's shape is needed, and the
// real entity graph hits the pre-existing circular import. The password hashing is REAL.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { In } from 'typeorm';
import { PasswordHashService } from '../password-hash/password-hash.service';
import { ScryptHashStrategy } from '../password-hash/strategies/scrypt-hash.strategy';
import { BcryptHashStrategy } from '../password-hash/strategies/bcrypt-hash.strategy';
import { UserService } from './user.service';

/**
 * GHSA-4r2r-mv32-3468 — boot-time check of an EXISTING database for seeded accounts that still use
 * their published default password. The seed guard only protects new databases.
 */
describe('UserService.findAccountsUsingPasswords', () => {
	const scrypt = new ScryptHashStrategy();
	const bcrypt = new BcryptHashStrategy();
	const hashing = new PasswordHashService(scrypt, [scrypt, bcrypt]);

	const PUBLISHED = [
		{ email: 'admin@ever.co', password: 'admin' },
		{ email: 'local.admin@ever.co', password: 'admin' },
		{ email: 'employee@ever.co', password: '12345678' }
	];

	function build(rows: Array<{ email: string; hash?: string }>, ormType = 'typeorm') {
		const typeOrmUserRepository = { find: jest.fn(async (_options: any) => rows) };
		const mikroOrmUserRepository = { find: jest.fn(async (_where: any) => rows) };
		const service: UserService = Object.create(UserService.prototype);
		Object.assign(service, {
			ormType,
			typeOrmUserRepository,
			mikroOrmUserRepository,
			_passwordHashService: hashing
		});
		return { service, typeOrmUserRepository, mikroOrmUserRepository };
	}

	it('reports an account whose stored hash still verifies against its published password', async () => {
		const { service } = build([
			{ email: 'admin@ever.co', hash: await scrypt.hash('admin') },
			{ email: 'employee@ever.co', hash: await bcrypt.hash('12345678') }
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual([
			'admin@ever.co',
			'employee@ever.co'
		]);
	});

	it('CONTROL: a rotated password is not reported', async () => {
		const { service } = build([
			{ email: 'admin@ever.co', hash: await scrypt.hash('rotated-after-install') },
			{ email: 'local.admin@ever.co' } // no password at all (e.g. social sign-in only)
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual([]);
	});

	it('does not cross-match one account against another account’s password', async () => {
		const { service } = build([{ email: 'employee@ever.co', hash: await scrypt.hash('admin') }]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual([]);
	});

	it('reports an email once even when it exists in several tenants', async () => {
		const hash = await scrypt.hash('admin');
		const { service } = build([
			{ email: 'admin@ever.co', hash },
			{ email: 'admin@ever.co', hash }
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual(['admin@ever.co']);
	});

	it('uses ONE query, selecting the hash for just those emails (TypeORM)', async () => {
		const { service, typeOrmUserRepository } = build([]);

		await service.findAccountsUsingPasswords(PUBLISHED);

		expect(typeOrmUserRepository.find).toHaveBeenCalledTimes(1);
		expect(typeOrmUserRepository.find).toHaveBeenCalledWith({
			where: { email: In(['admin@ever.co', 'local.admin@ever.co', 'employee@ever.co']) },
			select: { id: true, email: true, hash: true },
			take: 10
		});
	});

	it('uses ONE query on MikroORM too', async () => {
		const { service, mikroOrmUserRepository } = build([], 'mikro-orm');

		await service.findAccountsUsingPasswords(PUBLISHED);

		expect(mikroOrmUserRepository.find).toHaveBeenCalledTimes(1);
		expect(mikroOrmUserRepository.find).toHaveBeenCalledWith(
			{ email: { $in: ['admin@ever.co', 'local.admin@ever.co', 'employee@ever.co'] } },
			{ limit: 10 }
		);
	});

	/**
	 * `user.email` is only indexed, not unique, so the same seeded address can exist once per tenant.
	 * The check runs before the API listens and every verification is expensive by design, so both the
	 * query and the verifications have to be capped.
	 */
	it('caps the rows it reads and the passwords it verifies, so boot cannot stall', async () => {
		const hash = await scrypt.hash('not-the-published-one');
		const rows = Array.from({ length: 200 }, () => ({ email: 'admin@ever.co', hash }));
		const { service, typeOrmUserRepository } = build(rows);
		const verify = jest.spyOn(hashing, 'verify');

		try {
			await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual([]);

			expect(typeOrmUserRepository.find.mock.calls[0][0].take).toBe(10);
			// The repository is mocked, so it ignores `take` and hands back all 200 rows: the loop itself
			// must not verify more than the rows a real query would have returned.
			expect(verify.mock.calls.length).toBeLessThanOrEqual(10);
		} finally {
			verify.mockRestore();
		}
	});

	it('does not query at all without candidates', async () => {
		const { service, typeOrmUserRepository } = build([]);

		await expect(service.findAccountsUsingPasswords([])).resolves.toEqual([]);
		expect(typeOrmUserRepository.find).not.toHaveBeenCalled();
	});
});
