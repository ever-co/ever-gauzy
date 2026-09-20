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

	/**
	 * Stands in for the repositories. Each address is queried on its own now, so the fake applies the
	 * `where` and the row limit the way a real query would — otherwise the test would not notice a
	 * candidate that never gets looked at.
	 */
	function build(rows: Array<{ email: string; hash?: string }>, ormType = 'typeorm') {
		const rowsFor = (email: string, limit: number) => rows.filter((row) => row.email === email).slice(0, limit);
		const typeOrmUserRepository = {
			find: jest.fn(async (options: any) => rowsFor(options?.where?.email, options?.take ?? rows.length))
		};
		const mikroOrmUserRepository = {
			find: jest.fn(async (where: any, options: any) => rowsFor(where?.email, options?.limit ?? rows.length))
		};
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

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
			matches: ['admin@ever.co', 'employee@ever.co'],
			inconclusive: []
		});
	});

	it('CONTROL: a rotated password is not reported', async () => {
		const { service } = build([
			{ email: 'admin@ever.co', hash: await scrypt.hash('rotated-after-install') },
			{ email: 'local.admin@ever.co' } // no password at all (e.g. social sign-in only)
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({ matches: [], inconclusive: [] });
	});

	it('does not cross-match one account against another account’s password', async () => {
		const { service } = build([{ email: 'employee@ever.co', hash: await scrypt.hash('admin') }]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({ matches: [], inconclusive: [] });
	});

	it('reports an email once even when it exists in several tenants', async () => {
		const hash = await scrypt.hash('admin');
		const { service } = build([
			{ email: 'admin@ever.co', hash },
			{ email: 'admin@ever.co', hash }
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
			matches: ['admin@ever.co'],
			inconclusive: []
		});
	});

	it('queries each candidate address on its own, selecting only the hash (TypeORM)', async () => {
		const { service, typeOrmUserRepository } = build([]);

		await service.findAccountsUsingPasswords(PUBLISHED);

		expect(typeOrmUserRepository.find).toHaveBeenCalledTimes(3);
		expect(typeOrmUserRepository.find).toHaveBeenCalledWith({
			where: { email: 'admin@ever.co' },
			select: { id: true, email: true, hash: true },
			take: 5
		});
		expect(typeOrmUserRepository.find.mock.calls.map(([options]: any[]) => options.where.email)).toEqual([
			'admin@ever.co',
			'local.admin@ever.co',
			'employee@ever.co'
		]);
	});

	it('queries each candidate address on its own on MikroORM too', async () => {
		const { service, mikroOrmUserRepository } = build([], 'mikro-orm');

		await service.findAccountsUsingPasswords(PUBLISHED);

		expect(mikroOrmUserRepository.find).toHaveBeenCalledTimes(3);
		expect(mikroOrmUserRepository.find).toHaveBeenCalledWith({ email: 'admin@ever.co' }, { limit: 5 });
	});

	it('does not repeat a query for the same address, and tests every password proposed for it', async () => {
		// getPublishedSeedAccounts() can propose the canonical address and the configured one; when an
		// operator renamed only one of them the SAME address arrives twice, with different passwords.
		const { service, typeOrmUserRepository } = build([{ email: 'admin@ever.co', hash: await scrypt.hash('admin') }]);

		await expect(
			service.findAccountsUsingPasswords([
				{ email: 'admin@ever.co', password: '12345678' },
				{ email: 'admin@ever.co', password: 'admin' },
				{ email: 'admin@ever.co', password: 'admin' }
			])
		).resolves.toEqual({ matches: ['admin@ever.co'], inconclusive: [] });
		expect(typeOrmUserRepository.find).toHaveBeenCalledTimes(1);
	});

	/**
	 * The reason the budget is per address: with one shared `IN (...)` query and a global limit, the
	 * rows of whichever address the database happened to return first could use the whole allowance and
	 * hide a later candidate that still had its published password.
	 */
	it('still finds a vulnerable account behind many rotated rows of ANOTHER seeded address', async () => {
		const rotated = await scrypt.hash('rotated-after-install');
		const { service } = build([
			...Array.from({ length: 50 }, () => ({ email: 'admin@ever.co', hash: rotated })),
			{ email: 'employee@ever.co', hash: await scrypt.hash('12345678') }
		]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
			matches: ['employee@ever.co'],
			inconclusive: ['admin@ever.co']
		});
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
		// A repository that ignores `take` entirely: the loop itself must still stay bounded.
		typeOrmUserRepository.find.mockImplementation(async (options: any) =>
			rows.filter((row) => row.email === options?.where?.email)
		);
		const verify = jest.spyOn(hashing, 'verify');

		try {
			// `admin@ever.co` is reported as inconclusive: the budget ran out before its 200 rows did.
			await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
				matches: [],
				inconclusive: ['admin@ever.co']
			});

			expect(typeOrmUserRepository.find.mock.calls[0][0].take).toBe(5);
			// 5 rows per address, one password each, three addresses.
			expect(verify.mock.calls.length).toBeLessThanOrEqual(15);
		} finally {
			verify.mockRestore();
		}
	});

	it('reports a search that ran out of budget as inconclusive, not as clean', async () => {
		// Same address in more tenants than the cap: a vulnerable row can sit past the sample, so the
		// caller must be able to say "not exhaustively checked" instead of implying "clean".
		const rotated = await scrypt.hash('rotated-after-install');
		const { service } = build(Array.from({ length: 9 }, () => ({ email: 'admin@ever.co', hash: rotated })));

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
			matches: [],
			inconclusive: ['admin@ever.co']
		});
	});

	it('does not call an address inconclusive once it has already matched', async () => {
		const hash = await scrypt.hash('admin');
		const { service } = build(Array.from({ length: 9 }, () => ({ email: 'admin@ever.co', hash })));

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({
			matches: ['admin@ever.co'],
			inconclusive: []
		});
	});

	it('does not call an address inconclusive when all of its rows fit in the budget', async () => {
		const { service } = build([{ email: 'admin@ever.co', hash: await scrypt.hash('rotated-after-install') }]);

		await expect(service.findAccountsUsingPasswords(PUBLISHED)).resolves.toEqual({ matches: [], inconclusive: [] });
	});

	it('does not query at all without candidates', async () => {
		const { service, typeOrmUserRepository } = build([]);

		await expect(service.findAccountsUsingPasswords([])).resolves.toEqual({ matches: [], inconclusive: [] });
		expect(typeOrmUserRepository.find).not.toHaveBeenCalled();
	});
});
