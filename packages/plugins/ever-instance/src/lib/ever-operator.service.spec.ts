import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvents } from './ever-instance.events';
import { EverInstanceService } from './ever-instance.service';
import { EverOperatorService } from './ever-operator.service';
import { createCoreTables, dropTables, everInstanceMigration, openTestDataSource, q, TEST_TARGETS } from './fixtures/test-db';

const TABLES = ['ever_instance', 'user', 'role', 'tenant'];

// Creating and dropping tables on a real Postgres or MySQL takes longer than the default 5 s.
jest.setTimeout(120_000);

describe.each(TEST_TARGETS)('EverOperatorService on $name', (target) => {
	let dataSource: DataSource;
	const t = (name: string) => q(target.name, name);

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

	async function tenant(): Promise<string> {
		const id = randomUUID();
		await dataSource.query(`INSERT INTO ${t('tenant')} (${t('id')}, ${t('name')}) VALUES ('${id}', 'Acme')`);
		return id;
	}

	async function user(tenantId: string, roleName: string, email: string, createdAt: string): Promise<{ id: string; email: string }> {
		const roleId = randomUUID();
		const id = randomUUID();
		await dataSource.query(`INSERT INTO ${t('role')} (${t('id')}, ${t('name')}, ${t('tenantId')}) VALUES ('${roleId}', '${roleName}', '${tenantId}')`);
		await dataSource.query(
			`INSERT INTO ${t('user')} (${t('id')}, ${t('email')}, ${t('roleId')}, ${t('tenantId')}, ${t('createdAt')}) VALUES ('${id}', '${email}', '${roleId}', '${tenantId}', '${createdAt}')`
		);
		return { id, email };
	}

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

	it('with EVER_OPERATOR_EMAILS: the listed super admins, case-insensitive, on any number of tenants', async () => {
		const a = await user(await tenant(), 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		const b = await user(await tenant(), 'SUPER_ADMIN', 'someone@other.test', '2026-01-01 00:00:00');
		const { instance, operator } = services({ EVER_OPERATOR_EMAILS: ' OPS@acme.test , second@acme.test' });
		await instance.ensure();
		expect(await operator.isOperator(a, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator({ id: a.id, email: 'Ops@Acme.Test' }, 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(b, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(a, 'ADMIN')).toBe(false);
	});

	it('on Ever cloud: nobody, whatever the list says', async () => {
		const tenantId = await tenant();
		const first = await user(tenantId, 'SUPER_ADMIN', 'ops@acme.test', '2026-01-01 00:00:00');
		for (const env of [{ EVER_INSTALL_SOURCE: 'cloud' }, { EVER_INSTALL_SOURCE: 'cloud', EVER_OPERATOR_EMAILS: 'ops@acme.test' }]) {
			const { instance, operator } = services(env);
			await instance.ensure();
			expect(await operator.isOperator(first, 'SUPER_ADMIN')).toBe(false);
		}
	});

	it('with no user or no role: nobody', async () => {
		const { operator } = services();
		expect(await operator.isOperator(null, 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator({ id: 'x' }, null)).toBe(false);
	});
});
