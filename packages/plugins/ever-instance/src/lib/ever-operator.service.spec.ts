import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvents } from './ever-instance.events';
import { EverInstanceService } from './ever-instance.service';
import { EverOperatorService } from './ever-operator.service';
import { createCoreTables, dropTables, everInstanceMigration, openTestDataSource, q, TEST_TARGETS } from './fixtures/test-db';

const TABLES = ['ever_instance', 'user', 'role', 'tenant'];

// Creating and dropping tables on a real Postgres or MySQL takes longer than the default 5 s.
jest.setTimeout(120_000);

interface UserOptions {
	/** Whether the account confirmed its address (default true). */
	verified?: boolean;
	isActive?: boolean;
	deletedAt?: string;
}

describe.each(TEST_TARGETS)('EverOperatorService on $name', (target) => {
	let dataSource: DataSource;
	const t = (name: string) => q(target.name, name);
	const bool = (value: boolean) => (target.name === 'postgres' ? String(value) : value ? '1' : '0');

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
	});

	afterAll(async () => {
		await dropTables(dataSource, target.name, TABLES);
		await dataSource.destroy();
	});

	beforeEach(async () => {
		await dropTables(dataSource, target.name, TABLES);
		await createCoreTables(dataSource, target.name);
		const runner = dataSource.createQueryRunner();
		await everInstanceMigration().up(runner);
		await runner.release();
	});

	function services(env: Record<string, string | undefined> = {}) {
		const instance = new EverInstanceService(dataSource, new EverInstanceEvents(), { JWT_SECRET: 'x', ...env });
		return { instance, operator: new EverOperatorService(dataSource, instance, env) };
	}

	/** Tenants are created one minute apart, in the order of the calls. */
	let tenants = 0;
	async function tenant(): Promise<string> {
		const id = randomUUID();
		tenants += 1;
		const createdAt = `2025-01-01 00:${String(tenants).padStart(2, '0')}:00`;
		await dataSource.query(`INSERT INTO ${t('tenant')} (${t('id')}, ${t('name')}, ${t('createdAt')}) VALUES ('${id}', 'Acme', '${createdAt}')`);
		return id;
	}

	async function role(tenantId: string, roleName: string): Promise<string> {
		const roleId = randomUUID();
		await dataSource.query(`INSERT INTO ${t('role')} (${t('id')}, ${t('name')}, ${t('tenantId')}) VALUES ('${roleId}', '${roleName}', '${tenantId}')`);
		return roleId;
	}

	async function user(tenantId: string, roleName: string, email: string, createdAt: string, options: UserOptions = {}): Promise<{ id: string; email: string }> {
		const roleId = await role(tenantId, roleName);
		const id = randomUUID();
		const verified = options.verified === false ? 'NULL' : `'${createdAt}'`;
		const active = options.isActive === undefined ? 'NULL' : bool(options.isActive);
		const deleted = options.deletedAt ? `'${options.deletedAt}'` : 'NULL';
		await dataSource.query(
			`INSERT INTO ${t('user')} (${t('id')}, ${t('email')}, ${t('roleId')}, ${t('tenantId')}, ${t('emailVerifiedAt')}, ${t('isActive')}, ${t('deletedAt')}, ${t('createdAt')}) ` +
				`VALUES ('${id}', '${email}', '${roleId}', '${tenantId}', ${verified}, ${active}, ${deleted}, '${createdAt}')`
		);
		return { id, email };
	}

	const set = (userId: string, column: string, value: string) =>
		dataSource.query(`UPDATE ${t('user')} SET ${t(column)} = ${value} WHERE ${t('id')} = '${userId}'`);

	it('on one tenant without a list: the first super admin, pinned once', async () => {
		const tenantId = await tenant();
		const first = await user(tenantId, 'SUPER_ADMIN', 'first@acme.test', '2026-01-01 00:00:00');
		const second = await user(tenantId, 'SUPER_ADMIN', 'second@acme.test', '2026-02-01 00:00:00');
		const admin = await user(tenantId, 'ADMIN', 'admin@acme.test', '2025-01-01 00:00:00');
		const { instance, operator } = services();
		await instance.ensure();
		expect(await operator.isOperator(second, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(admin, 'ADMIN')).toBe(false);
		expect((await instance.get())?.operatorUserId).toBe(first.id);
	});

	it('on one tenant: a pinned operator who is deactivated, deleted or demoted is replaced by the next super admin (compare and set)', async () => {
		const tenantId = await tenant();
		const first = await user(tenantId, 'SUPER_ADMIN', 'first@acme.test', '2026-01-01 00:00:00');
		const second = await user(tenantId, 'SUPER_ADMIN', 'second@acme.test', '2026-02-01 00:00:00');
		const third = await user(tenantId, 'SUPER_ADMIN', 'third@acme.test', '2026-03-01 00:00:00');
		const { instance, operator } = services();
		await instance.ensure();
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(true);

		await set(first.id, 'isActive', bool(false));
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(second, 'SUPER_ADMIN')).toBe(true);
		expect((await instance.get())?.operatorUserId).toBe(second.id);

		await set(second.id, 'roleId', `'${await role(tenantId, 'ADMIN')}'`);
		expect(await operator.isOperator(third, 'SUPER_ADMIN')).toBe(true);
		expect((await instance.get())?.operatorUserId).toBe(third.id);

		await set(third.id, 'deletedAt', `'2026-04-01 00:00:00'`);
		expect(await operator.isOperator(third, 'SUPER_ADMIN')).toBe(false);

		// The first usable super admin to ask takes the stale pin over; a stale value never
		// overwrites a newer pin (compare and set).
		await set(first.id, 'isActive', bool(true));
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(true);
		expect((await instance.get())?.operatorUserId).toBe(first.id);
		expect(await instance.repinOperator(third.id, second.id)).toBe(first.id);
	});

	it('on two tenants without a list: nobody, not even a pinned operator', async () => {
		const tenantId = await tenant();
		const first = await user(tenantId, 'SUPER_ADMIN', 'first@acme.test', '2026-01-01 00:00:00');
		const { instance, operator } = services();
		await instance.ensure();
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(true);
		const other = await tenant();
		const stranger = await user(other, 'SUPER_ADMIN', 'stranger@other.test', '2025-01-01 00:00:00');
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(stranger, 'SUPER_ADMIN')).toBe(false);
	});

	it('with EVER_OPERATOR_EMAILS: the account of the first tenant with a listed, confirmed address, case-insensitive, on any number of tenants', async () => {
		const a = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		const b = await user(await tenant(), 'SUPER_ADMIN', 'someone@other.test', '2026-01-01 00:00:00');
		const { instance, operator } = services({ EVER_OPERATOR_EMAILS: ' OPS@acme.test , second@acme.test' });
		await instance.ensure();
		expect(await operator.isOperator(a, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator({ id: a.id, email: 'Ops@Acme.Test' }, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(b, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(a, 'ADMIN')).toBe(false);
		// The address the request claims does not matter: the database's does.
		expect(await operator.isOperator({ id: b.id, email: 'ops@acme.test' }, 'SUPER_ADMIN')).toBe(false);
	});

	it('takeover: an account of another tenant with the listed address is never the operator, confirmed or not, older or newer', async () => {
		const operatorAccount = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		const strangerTenant = await tenant();
		const unconfirmed = await user(strangerTenant, 'SUPER_ADMIN', 'OPS@acme.test', '2026-05-01 00:00:00', { verified: false });
		const confirmed = await user(strangerTenant, 'SUPER_ADMIN', 'ops@acme.test', '2026-05-02 00:00:00');
		// An account created BEFORE the operator's, confirmed for another address, that changed its
		// address to the listed one (Gauzy keeps the confirmation and the creation date).
		const older = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2025-06-01 00:00:00');
		const { instance, operator } = services({ EVER_OPERATOR_EMAILS: 'ops@acme.test' });
		await instance.ensure();
		expect(await operator.isOperator(unconfirmed, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(confirmed, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(older, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(operatorAccount, 'SUPER_ADMIN')).toBe(true);
		// Deleting or deactivating the operator's account never hands the address to another one.
		await set(operatorAccount.id, 'deletedAt', `'2026-06-01 00:00:00'`);
		expect(await operator.isOperator(operatorAccount, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(confirmed, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(older, 'SUPER_ADMIN')).toBe(false);
	});

	it('a second account of the first tenant taking the listed address leaves nobody designated by it (fail closed)', async () => {
		const first = await tenant();
		const operatorAccount = await user(first, 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		const coAdmin = await user(first, 'SUPER_ADMIN', 'co-admin@acme.test', '2025-06-01 00:00:00');
		const { instance, operator } = services({ EVER_OPERATOR_EMAILS: 'ops@acme.test' });
		await instance.ensure();
		expect(await operator.isOperator(operatorAccount, 'SUPER_ADMIN')).toBe(true);
		await set(coAdmin.id, 'email', `'ops@acme.test'`);
		expect(await operator.isOperator(coAdmin, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(operatorAccount, 'SUPER_ADMIN')).toBe(false);
	});

	it('a listed address counts only once its first account has confirmed it', async () => {
		const first = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00', { verified: false });
		const { instance, operator } = services({ EVER_OPERATOR_EMAILS: 'ops@acme.test' });
		await instance.ensure();
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(false);
		await set(first.id, 'emailVerifiedAt', `'2026-01-02 00:00:00'`);
		expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(true);
	});

	it('with EVER_OPERATOR_USER_IDS: the listed users while they are active super admins, never another account with the same address', async () => {
		const tenantId = await tenant();
		const listed = await user(tenantId, 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00', { verified: false });
		const sameAddress = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2026-05-01 00:00:00');
		const { instance, operator } = services({ EVER_OPERATOR_USER_IDS: ` ${listed.id.toUpperCase()} , ${randomUUID()}` });
		await instance.ensure();
		expect(await operator.isOperator(listed, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(sameAddress, 'SUPER_ADMIN')).toBe(false);
		await set(listed.id, 'isActive', bool(false));
		expect(await operator.isOperator(listed, 'SUPER_ADMIN')).toBe(false);
		await set(listed.id, 'isActive', bool(true));
		await set(listed.id, 'roleId', `'${await role(tenantId, 'ADMIN')}'`);
		expect(await operator.isOperator(listed, 'SUPER_ADMIN')).toBe(false);
		expect((await instance.get())?.operatorUserId).toBeNull();
	});

	it('on Ever cloud: nobody, whatever the lists say', async () => {
		const tenantId = await tenant();
		const first = await user(tenantId, 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		for (const env of [
			{ EVER_INSTALL_SOURCE: 'cloud' },
			{ EVER_INSTALL_SOURCE: 'cloud', EVER_OPERATOR_EMAILS: 'ops@acme.test' },
			{ EVER_INSTALL_SOURCE: 'cloud', EVER_OPERATOR_USER_IDS: first.id }
		]) {
			const { instance, operator } = services(env);
			await instance.ensure();
			expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(false);
		}
	});

	it('with no user, no role or an unknown user: nobody', async () => {
		await tenant();
		const { operator } = services();
		expect(await operator.isOperator(null, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator({ id: 'x' }, null)).toBe(false);
		expect(await operator.isOperator({ id: randomUUID() }, 'SUPER_ADMIN')).toBe(false);
	});
});
