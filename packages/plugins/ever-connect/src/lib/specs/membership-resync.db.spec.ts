import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectStore } from '../ever-connect.store';
import {
	CORE_TABLES,
	createCoreTables,
	dropTables,
	insert,
	migrateUp,
	openTestDataSource,
	PLUGIN_TABLES,
	q,
	seedTenant,
	SeededTenant,
	TEST_TARGETS,
	TestDialect
} from '../fixtures/test-db';
import { LINK_MEMBERSHIPS_OPERATION } from '../membership/membership-resync';
import { MEMBERSHIP_AUDIT_ACTION, MembershipSyncHandler } from '../membership/membership-sync.handler';
import { ProblemError } from '../sdk';

/**
 * The membership resync on real databases (`EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED`): after the feed answered
 * `410 resync_required` (and once after each start), the current members of each linked Ever organization
 * (`GET /v1/instances/me/tenant-links/{link}/memberships`, 100 a page) are applied with the rules of the events.
 *
 * - Every page is read; each member joins (as `created`), or only gets the role when the sync keeps them as a member
 *   (as `role_changed`: made inactive in Gauzy, they are not made a member again).
 * - Once the whole list was read, the members the sync keeps whom the list no longer names are removed (as
 *   `removed`); nobody else is.
 * - Nothing changed: no audit row; the next event of the feed is still applied after a resync.
 * - `404 module_disabled`: nothing to resync, said once. A failure stops the resync, and nobody is removed.
 */
describe.each(TEST_TARGETS)('Ever Platform membership resync ($name)', (target) => {
	const ON = { EVER_CONNECT_ENABLED: 'true', EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'true', ZITADEL_ENABLED: 'true' };
	const ISSUER = 'https://auth.example.test';
	const LINK = '01JC5M2R4T6V8X0Z2B4D6F8H0K';
	const d: TestDialect = target.name;
	let dataSource: DataSource;
	let store: EverConnectStore;
	let audit: EverConnectAuditService;
	let seeded: SeededTenant;
	let roles: { admin: string; employee: string; superAdmin: string };
	let clock: number;

	const handler = (env: Record<string, string | undefined> = ON) =>
		new MembershipSyncHandler(dataSource, store, audit, env);

	const member = (subject: string, role = 'member', values: Record<string, unknown> = {}) => ({
		identity_issuer: ISSUER,
		identity_subject: subject,
		role,
		...values
	});

	/** The pages of a list, each pointing at the next. */
	const pages = (...lists: unknown[][]) =>
		lists.map((items, index) => ({
			tenant_link_id: LINK,
			items,
			next_cursor: index < lists.length - 1 ? `cursor-${index + 1}` : null
		}));

	/** An SDK client whose `call` answers (or fails) in turn. */
	const platform = (...answers: Array<object | Error>) => {
		const call = jest.fn();
		for (const answer of answers) {
			if (answer instanceof Error) call.mockRejectedValueOnce(answer);
			else call.mockResolvedValueOnce(answer);
		}
		return { call };
	};

	const envelope = (
		id: string,
		change: 'created' | 'role_changed' | 'removed',
		values: Record<string, unknown> = {},
		occurredAt = '2026-11-02T10:00:00Z'
	) =>
		({
			id,
			type: `ever.registry.membership.${change}`,
			version: 1,
			occurred_at: occurredAt,
			subject: { kind: 'tenant_link', id: LINK },
			data: {
				tenant_link_id: LINK,
				identity_issuer: ISSUER,
				identity_subject: 'sub-bob',
				role: 'admin',
				...values
			}
		}) as never;

	const ph = (n: number) => (d === 'postgres' ? `$${n}` : '?');

	const roleOf = async (userId: string): Promise<string | null> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT ${q(d, 'roleId')} AS ${q(d, 'roleId')} FROM ${q(d, 'user')} WHERE ${q(d, 'id')} = ${ph(1)}`,
			[userId]
		);
		return rows[0] ? (rows[0]['roleId'] as string | null) : null;
	};

	const memberships = async (userId: string): Promise<boolean[]> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT ${q(d, 'isActive')} AS ${q(d, 'isActive')} FROM ${q(d, 'user_organization')} WHERE ${q(d, 'organizationId')} = ${ph(1)} AND ${q(d, 'userId')} = ${ph(2)}`,
			[seeded.organizationId, userId]
		);
		return rows.map((row) => row['isActive'] === true || row['isActive'] === 1 || row['isActive'] === '1');
	};

	const deactivate = (userId: string) =>
		dataSource.query(
			`UPDATE ${q(d, 'user_organization')} SET ${q(d, 'isActive')} = ${ph(1)} WHERE ${q(d, 'userId')} = ${ph(2)}`,
			[d === 'postgres' ? false : 0, userId]
		);

	const syncRows = async (): Promise<Array<Record<string, unknown> & { details: Record<string, unknown> }>> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT * FROM ${q(d, 'ever_connect_audit')} WHERE ${q(d, 'action')} = ${ph(1)} ORDER BY ${q(d, 'at')} ASC`,
			[MEMBERSHIP_AUDIT_ACTION]
		);
		return rows.map((row) => ({ ...row, details: JSON.parse(String(row['details'])) }));
	};

	/** Links `userId` to an Ever ID (the Ever ID sign-in plugin's table). */
	const linkEverId = async (userId: string, subject: string): Promise<string> => {
		const id = randomUUID();
		await insert(dataSource, d, 'zitadel_account', {
			id,
			tenantId: seeded.tenantId,
			userId,
			issuer: ISSUER,
			subject,
			linkMethod: 'explicit'
		});
		return id;
	};

	/** A user of the tenant with a role, optionally a member of the organization. */
	const addUser = async (roleId: string, member: boolean): Promise<string> => {
		const id = randomUUID();
		await insert(dataSource, d, 'user', {
			id,
			tenantId: seeded.tenantId,
			email: `${id}@example.test`,
			roleId,
			isActive: true,
			isArchived: false
		});
		if (member) {
			await insert(dataSource, d, 'user_organization', {
				id: randomUUID(),
				tenantId: seeded.tenantId,
				organizationId: seeded.organizationId,
				userId: id,
				isActive: true,
				isArchived: false
			});
		}
		return id;
	};

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES, 'zitadel_account']);
		await dataSource.destroy();
	});

	beforeEach(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES, 'zitadel_account']);
		await migrateUp(dataSource);
		await createCoreTables(dataSource, d);
		const id = 'varchar(64)';
		const ts = d === 'postgres' ? 'timestamp' : d === 'mysql' ? 'datetime(6)' : 'datetime';
		await dataSource.query(
			`CREATE TABLE ${q(d, 'zitadel_account')} (${q(d, 'id')} ${id} PRIMARY KEY, ${q(d, 'tenantId')} ${id} NULL, ${q(d, 'userId')} ${id} NOT NULL, ${q(d, 'issuer')} varchar(255) NOT NULL, ${q(d, 'subject')} varchar(255) NOT NULL, ${q(d, 'linkMethod')} varchar(32) NOT NULL, ${q(d, 'deletedAt')} ${ts} NULL)`
		);
		clock = Date.parse('2026-11-19T10:00:00Z');
		const now = { now: () => (clock += 1_000) };
		store = new EverConnectStore(dataSource, now);
		audit = new EverConnectAuditService(dataSource, now);
		seeded = await seedTenant(dataSource, d, 'acme', '2026-01-01 00:00:00', 'owner@example.test');
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT ${q(d, 'id')} AS ${q(d, 'id')}, ${q(d, 'name')} AS ${q(d, 'name')} FROM ${q(d, 'role')}`
		);
		const byName = (name: string) => String(rows.find((row) => row['name'] === name)?.['id']);
		roles = { admin: randomUUID(), employee: byName('EMPLOYEE'), superAdmin: byName('SUPER_ADMIN') };
		await insert(dataSource, d, 'role', { id: roles.admin, name: 'ADMIN', tenantId: seeded.tenantId });
		await store.insertLink({
			tenantId: seeded.tenantId,
			organizationId: seeded.organizationId,
			integrationTenantId: null,
			linkId: LINK,
			everOrgId: '01JNB79NZW2S85GF4A96MMX6BT',
			everHandle: 'acme',
			status: 'linked',
			entitlementJwsEncrypted: null,
			entitlementSeq: null,
			entitlementIat: null,
			entitlementExp: null,
			entitlementFetchedAt: null
		});
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('switched off: nothing is read or written', async () => {
		const client = platform();
		expect(await handler({}).resync(client)).toBe('switched_off');
		expect(client.call).not.toHaveBeenCalled();
		expect(await syncRows()).toEqual([]);
	});

	it('reads every page and applies each member with the rules of the events', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const carol = await addUser(roles.employee, false);
		await linkEverId(carol, 'sub-carol');
		const client = platform(
			...pages([member('sub-bob', 'admin')], [member('sub-carol', 'member', { product_user_ref: carol })])
		);

		expect(await handler().resync(client)).toBe('done');

		expect(client.call.mock.calls).toEqual([
			[LINK_MEMBERSHIPS_OPERATION, { path: { link: LINK }, query: { limit: 100, cursor: undefined } }],
			[LINK_MEMBERSHIPS_OPERATION, { path: { link: LINK }, query: { limit: 100, cursor: 'cursor-1' } }]
		]);
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		expect(await memberships(carol)).toEqual([true]);
		expect(await roleOf(carol)).toBe(roles.employee);
		const rows = await syncRows();
		expect(rows.map((row) => [row.details['user_id'], row.details['op'], row.details['result']])).toEqual([
			[seeded.employeeId, 'created', 'role_granted'],
			[carol, 'created', 'added']
		]);
		expect(rows.every((row) => row.details['source'] === 'resync')).toBe(true);
		// Placed before every event: time 0.
		expect(rows[0].details['occurred_at']).toBe(0);
	});

	it('a resync that changes nothing writes nothing; the next event of the feed is still applied', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		await sync.resync(platform(...pages([member('sub-bob', 'admin')])));
		expect(await syncRows()).toHaveLength(1);

		expect(await sync.resync(platform(...pages([member('sub-bob', 'admin')])))).toBe('done');
		expect(await syncRows()).toHaveLength(1);

		expect(await sync.apply(envelope('01JD0000000000000000000002', 'role_changed', { role: 'member' }))).toBe(
			'role_revoked'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it('after an event, a resync takes its place right after it', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'member' }))).toBe(
			'unchanged'
		);
		// Promoted on Ever Platform while the feed lost the event.
		expect(await sync.resync(platform(...pages([member('sub-bob', 'owner')])))).toBe('done');
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		const rows = await syncRows();
		expect(rows[1].details).toMatchObject({
			event_id: '01JD0000000000000000000001.000000001',
			occurred_at: Date.parse('2026-11-02T10:00:00Z'),
			op: 'role_changed',
			result: 'role_granted',
			source: 'resync'
		});
		// The lost event, read again later, is older: skipped.
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'member' }))).toBe('stale');
		// The next event, even of the same millisecond with the next id, is applied after the resync.
		expect(await sync.apply(envelope('01JD0000000000000000000002', 'role_changed', { role: 'member' }))).toBe(
			'role_revoked'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it('a member the sync keeps only gets the role: made inactive in Gauzy, not made a member again', async () => {
		const carol = await addUser(roles.employee, false);
		await linkEverId(carol, 'sub-carol');
		const sync = handler();
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000001', 'created', { identity_subject: 'sub-carol', role: 'member' })
			)
		).toBe('added');
		await deactivate(carol);

		expect(await sync.resync(platform(...pages([member('sub-carol')])))).toBe('done');

		expect(await memberships(carol)).toEqual([false]);
		expect(await syncRows()).toHaveLength(1);
	});

	it('removes the members the sync keeps whom the list no longer names, and nobody else', async () => {
		const sync = handler();
		// Bob: kept by the sync (made ADMIN by it).
		await linkEverId(seeded.employeeId, 'sub-bob');
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('role_granted');
		// Dave: a member who joined in Gauzy, with an Ever ID, never named by Ever Platform.
		const dave = await addUser(roles.employee, true);
		await linkEverId(dave, 'sub-dave');
		// Erin: kept by the sync, but her Ever ID link is gone since.
		const erin = await addUser(roles.employee, false);
		const erinLink = await linkEverId(erin, 'sub-erin');
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000002', 'created', { identity_subject: 'sub-erin', role: 'member' })
			)
		).toBe('added');
		await dataSource.query(
			`UPDATE ${q(d, 'zitadel_account')} SET ${q(d, 'deletedAt')} = ${ph(1)} WHERE ${q(d, 'id')} = ${ph(2)}`,
			['2026-11-19 10:00:00', erinLink]
		);
		const carol = await addUser(roles.employee, false);
		await linkEverId(carol, 'sub-carol');

		expect(await sync.resync(platform(...pages([member('sub-carol')])))).toBe('done');

		expect(await memberships(carol)).toEqual([true]);
		expect(await memberships(seeded.employeeId)).toEqual([false]);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await memberships(dave)).toEqual([true]);
		expect(await memberships(erin)).toEqual([true]);
		expect(await memberships(seeded.superAdminId)).toEqual([true]);
		const removal = (await syncRows()).find(
			(row) => row.details['user_id'] === seeded.employeeId && row.details['op'] === 'removed'
		);
		expect(removal?.details).toMatchObject({ result: 'removed', source: 'resync' });
	});

	it('an empty list, or one with an item it cannot read, removes nobody', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'member' }));

		expect(await sync.resync(platform(...pages([])))).toBe('done');
		expect(await sync.resync(platform(...pages([{ identity_subject: 'sub-carol' }])))).toBe('done');

		expect(await memberships(seeded.employeeId)).toEqual([true]);
		expect(await syncRows()).toHaveLength(1);
	});

	it('404 module_disabled: nothing to resync, said once', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		const sync = handler();
		const client = platform(new ProblemError(404, 'module_disabled'), new ProblemError(404, 'module_disabled'));

		expect(await sync.resync(client)).toBe('module_disabled');
		expect(await sync.resync(client)).toBe('module_disabled');

		expect(client.call).toHaveBeenCalledTimes(2);
		const said = () => log.mock.calls.filter(([message]) => String(message).includes('module_disabled'));
		expect(said()).toHaveLength(1);
		expect(await syncRows()).toEqual([]);

		// Switched on, then off again on Ever Platform: said again.
		client.call.mockResolvedValueOnce(pages([])[0]).mockRejectedValueOnce(new ProblemError(404, 'module_disabled'));
		expect(await sync.resync(client)).toBe('done');
		expect(await sync.resync(client)).toBe('module_disabled');
		expect(said()).toHaveLength(2);
	});

	it('an error mid-way stops the resync, and nobody is removed', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'member' }));
		const carol = await addUser(roles.employee, false);
		await linkEverId(carol, 'sub-carol');
		const [first] = pages([member('sub-carol')], [member('sub-dave')]);
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		expect(await sync.resync(platform(first, new ProblemError(503, 'unavailable')))).toBe('failed');

		expect(await memberships(carol)).toEqual([true]);
		expect(await memberships(seeded.employeeId)).toEqual([true]);
		expect(warn).toHaveBeenCalled();
	});

	it('a link Ever Platform does not know as live is skipped; a lost lease stops the resync', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		expect(await sync.resync(platform(new ProblemError(404, 'not_found')))).toBe('done');
		expect(await syncRows()).toEqual([]);

		const client = platform(...pages([member('sub-bob', 'admin')]));
		expect(await sync.resync(client, async () => false)).toBe('lease_lost');
		expect(client.call).not.toHaveBeenCalled();
	});

	it('the lease is checked before each change: lost in the middle of a page, nothing more is written', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const carol = await addUser(roles.employee, false);
		await linkEverId(carol, 'sub-carol');
		let renewals = 0;
		// The page, then Bob; lost before Carol.
		const keep = async () => ++renewals <= 2;

		expect(
			await handler().resync(platform(...pages([member('sub-bob', 'admin'), member('sub-carol')])), keep)
		).toBe('lease_lost');

		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		expect(await memberships(carol)).toEqual([]);
	});

	it('a cursor answered before stops the resync (a cycle), and nobody is removed', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'member' }));
		const client = platform(
			{ items: [], next_cursor: 'A' },
			{ items: [], next_cursor: 'B' },
			{ items: [], next_cursor: 'A' }
		);

		expect(await sync.resync(client)).toBe('failed');
		expect(client.call).toHaveBeenCalledTimes(3);
		expect(await memberships(seeded.employeeId)).toEqual([true]);
	});

	it('a resync that finds the owner again writes no row the second time', async () => {
		await linkEverId(seeded.superAdminId, 'sub-owner');
		const sync = handler();
		await sync.resync(platform(...pages([member('sub-owner', 'owner')])));
		const rows = await syncRows();
		expect(rows.map((row) => row.details['result'])).toEqual(['super_admin_kept']);

		await sync.resync(platform(...pages([member('sub-owner', 'owner')])));
		expect(await syncRows()).toHaveLength(1);
		expect(await roleOf(seeded.superAdminId)).toBe(roles.superAdmin);
	});
});
