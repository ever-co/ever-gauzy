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
import { MEMBERSHIP_AUDIT_ACTION, MembershipSyncHandler } from '../membership/membership-sync.handler';

/**
 * The membership sync on real databases (`EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED`): the membership changes Ever
 * Platform sends for an Ever organization linked to a Gauzy organization, applied to that organization's users.
 *
 * - The person is the one Gauzy user of the tenant linked to the Ever ID; nobody else changes, and no user is
 *   ever created.
 * - `owner` and `admin` make the user `ADMIN`; `member` gives back the role an `ADMIN` granted by the sync replaced.
 *   A `SUPER_ADMIN`, and an `ADMIN` given in Gauzy, are never changed.
 * - `created` makes the user a member of the organization; `removed` makes the membership inactive (the rows and
 *   the user stay).
 * - The same event twice changes nothing more; an older event than the last one applied is skipped.
 */
describe.each(TEST_TARGETS)('Ever Platform membership sync ($name)', (target) => {
	const ON = { EVER_CONNECT_ENABLED: 'true', EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'true', ZITADEL_ENABLED: 'true' };
	const ISSUER = 'https://auth.example.test';
	const LINK = '01JC5M2R4T6V8X0Z2B4D6F8H0K';
	const LINK_B = '01JC5M2R4T6V8X0Z2B4D6F8H0M';
	const d: TestDialect = target.name;
	let dataSource: DataSource;
	let store: EverConnectStore;
	let audit: EverConnectAuditService;
	let seeded: SeededTenant;
	let roles: { admin: string; employee: string; manager: string; superAdmin: string };
	let clock: number;

	const handler = (env: Record<string, string | undefined> = ON) =>
		new MembershipSyncHandler(dataSource, store, audit, env);

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

	const roleOf = async (userId: string): Promise<string | null> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT ${q(d, 'roleId')} AS ${q(d, 'roleId')} FROM ${q(d, 'user')} WHERE ${q(d, 'id')} = ${d === 'postgres' ? '$1' : '?'}`,
			[userId]
		);
		return rows[0] ? (rows[0]['roleId'] as string | null) : null;
	};

	const memberships = async (organizationId: string, userId: string): Promise<boolean[]> => {
		const ph = (n: number) => (d === 'postgres' ? `$${n}` : '?');
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT ${q(d, 'isActive')} AS ${q(d, 'isActive')} FROM ${q(d, 'user_organization')} WHERE ${q(d, 'organizationId')} = ${ph(1)} AND ${q(d, 'userId')} = ${ph(2)}`,
			[organizationId, userId]
		);
		return rows.map((row) => row['isActive'] === true || row['isActive'] === 1 || row['isActive'] === '1');
	};

	const syncRows = async (): Promise<Array<Record<string, unknown>>> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT * FROM ${q(d, 'ever_connect_audit')} WHERE ${q(d, 'action')} = ${d === 'postgres' ? '$1' : '?'} ORDER BY ${q(d, 'at')} ASC`,
			[MEMBERSHIP_AUDIT_ACTION]
		);
		return rows.map((row) => ({ ...row, details: JSON.parse(String(row['details'])) }));
	};

	const userCount = async (): Promise<number> => {
		const rows: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT COUNT(*) AS n FROM ${q(d, 'user')}`
		);
		return Number(rows[0]['n']);
	};

	/** Links `userId` to an Ever ID (the Ever ID sign-in plugin's table). */
	const linkEverId = (userId: string, subject: string, issuer = ISSUER) =>
		insert(dataSource, d, 'zitadel_account', {
			id: randomUUID(),
			tenantId: seeded.tenantId,
			userId,
			issuer,
			subject,
			linkMethod: 'explicit'
		});

	/** A user of the tenant with a role, optionally a member of the organization. */
	const addUser = async (roleId: string, organizationId: string | null): Promise<string> => {
		const id = randomUUID();
		await insert(dataSource, d, 'user', {
			id,
			tenantId: seeded.tenantId,
			email: `${id}@example.test`,
			roleId,
			isActive: true,
			isArchived: false
		});
		if (organizationId) {
			await insert(dataSource, d, 'user_organization', {
				id: randomUUID(),
				tenantId: seeded.tenantId,
				organizationId,
				userId: id,
				isActive: true,
				isArchived: false
			});
		}
		return id;
	};

	const addLink = (organizationId: string, linkId: string, status = 'linked') =>
		store.insertLink({
			tenantId: seeded.tenantId,
			organizationId,
			integrationTenantId: null,
			linkId,
			everOrgId: '01JNB79NZW2S85GF4A96MMX6BT',
			everHandle: 'acme',
			status: status as never,
			entitlementJwsEncrypted: null,
			entitlementSeq: null,
			entitlementIat: null,
			entitlementExp: null,
			entitlementFetchedAt: null
		});

	const addOrganization = async (): Promise<string> => {
		const id = randomUUID();
		await insert(dataSource, d, 'organization', {
			id,
			tenantId: seeded.tenantId,
			name: 'second organization',
			isActive: true,
			isArchived: false
		});
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
		roles = {
			admin: randomUUID(),
			manager: randomUUID(),
			employee: byName('EMPLOYEE'),
			superAdmin: byName('SUPER_ADMIN')
		};
		await insert(dataSource, d, 'role', { id: roles.admin, name: 'ADMIN', tenantId: seeded.tenantId });
		await insert(dataSource, d, 'role', { id: roles.manager, name: 'MANAGER', tenantId: seeded.tenantId });
		await addLink(seeded.organizationId, LINK);
	});

	it('switched off: nothing is read or written', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		for (const env of [
			{},
			{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: undefined },
			{ ...ON, ZITADEL_ENABLED: undefined }
		]) {
			expect(await handler(env).apply(envelope('01JD0000000000000000000001', 'created'))).toBe('switched_off');
		}
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await syncRows()).toEqual([]);
	});

	it('an Ever admin becomes ADMIN; a demotion to member gives the role before back', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();

		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('role_granted');
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		expect(await memberships(seeded.organizationId, seeded.employeeId)).toEqual([true]);

		expect(
			await sync.apply(
				envelope('01JD0000000000000000000002', 'role_changed', { role: 'member' }, '2026-11-03T10:00:00Z')
			)
		).toBe('role_revoked');
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);

		const rows = await syncRows();
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			tenantId: seeded.tenantId,
			organizationId: seeded.organizationId,
			actorLabel: 'platform',
			details: {
				event_id: '01JD0000000000000000000001',
				op: 'created',
				role: 'admin',
				user_id: seeded.employeeId,
				result: 'role_granted',
				from: 'EMPLOYEE',
				to: 'ADMIN',
				held: true,
				restore: roles.employee
			}
		});
		expect(rows[1]).toMatchObject({
			details: { result: 'role_revoked', from: 'ADMIN', to: 'EMPLOYEE', held: false }
		});
		// Ids, roles and outcomes only: never an e-mail or an address.
		expect(JSON.stringify(rows)).not.toMatch(/@|https?:\/\//);
	});

	it('an Ever owner is ADMIN here, never SUPER_ADMIN', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		expect(await handler().apply(envelope('01JD0000000000000000000001', 'role_changed', { role: 'owner' }))).toBe(
			'role_granted'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
	});

	it('the same event twice changes nothing more; an older event is skipped', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		const removed = envelope('01JD0000000000000000000002', 'removed', { role: 'admin' }, '2026-11-03T10:00:00Z');
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('role_granted');
		expect(await sync.apply(removed)).toBe('removed');
		expect(await sync.apply(removed)).toBe('duplicate');
		// The addition happened before the removal: applying it again now would undo it.
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('stale');
		expect(await sync.apply(envelope('01JD0000000000000000000000', 'created', {}, '2026-11-01T10:00:00Z'))).toBe(
			'stale'
		);
		expect(await memberships(seeded.organizationId, seeded.employeeId)).toEqual([false]);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await syncRows()).toHaveLength(2);
	});

	it('removed: the ADMIN the sync granted goes, the membership becomes inactive, nothing is deleted', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const users = await userCount();
		const sync = handler();
		await sync.apply(envelope('01JD0000000000000000000001', 'created'));
		expect(await sync.apply(envelope('01JD0000000000000000000002', 'removed', {}, '2026-11-03T10:00:00Z'))).toBe(
			'removed'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await memberships(seeded.organizationId, seeded.employeeId)).toEqual([false]);
		expect(await userCount()).toBe(users);
		// Added again later: the same membership row is active again.
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000003', 'created', { role: 'member' }, '2026-11-04T10:00:00Z')
			)
		).toBe('added');
		expect(await memberships(seeded.organizationId, seeded.employeeId)).toEqual([true]);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it('created: a user of the tenant who is not a member joins the organization', async () => {
		const carol = await addUser(roles.employee, null);
		await linkEverId(carol, 'sub-carol');
		expect(
			await handler().apply(
				envelope('01JD0000000000000000000001', 'created', { identity_subject: 'sub-carol', role: 'member' })
			)
		).toBe('added');
		expect(await memberships(seeded.organizationId, carol)).toEqual([true]);
		expect(await roleOf(carol)).toBe(roles.employee);
		// A role change for someone who is not a member changes nothing.
		const dave = await addUser(roles.employee, null);
		await linkEverId(dave, 'sub-dave');
		expect(
			await handler().apply(
				envelope('01JD0000000000000000000002', 'role_changed', { identity_subject: 'sub-dave' })
			)
		).toBe('not_a_member');
		expect(await roleOf(dave)).toBe(roles.employee);
		expect(await memberships(seeded.organizationId, dave)).toEqual([]);
	});

	it('an ADMIN given in Gauzy and the SUPER_ADMIN are never changed', async () => {
		const erin = await addUser(roles.admin, seeded.organizationId);
		await linkEverId(erin, 'sub-erin');
		await linkEverId(seeded.superAdminId, 'sub-owner');
		const sync = handler();

		expect(
			await sync.apply(envelope('01JD0000000000000000000001', 'created', { identity_subject: 'sub-erin' }))
		).toBe('unchanged');
		expect(
			await sync.apply(
				envelope(
					'01JD0000000000000000000002',
					'role_changed',
					{ identity_subject: 'sub-erin', role: 'member' },
					'2026-11-03T10:00:00Z'
				)
			)
		).toBe('unchanged');
		expect(await roleOf(erin)).toBe(roles.admin);

		for (const [id, change, role] of [
			['01JD0000000000000000000011', 'created', 'owner'],
			['01JD0000000000000000000012', 'role_changed', 'member'],
			['01JD0000000000000000000013', 'removed', 'owner']
		] as const) {
			expect(await sync.apply(envelope(id, change, { identity_subject: 'sub-owner', role }))).toBe(
				'super_admin_kept'
			);
		}
		expect(await roleOf(seeded.superAdminId)).toBe(roles.superAdmin);
		expect(await memberships(seeded.organizationId, seeded.superAdminId)).toEqual([true]);
	});

	it('a role changed in Gauzy after the grant is left as it is', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		await sync.apply(envelope('01JD0000000000000000000001', 'created'));
		await dataSource.query(
			`UPDATE ${q(d, 'user')} SET ${q(d, 'roleId')} = ${d === 'postgres' ? '$1' : '?'} WHERE ${q(d, 'id')} = ${d === 'postgres' ? '$2' : '?'}`,
			[roles.manager, seeded.employeeId]
		);
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000002', 'role_changed', { role: 'member' }, '2026-11-03T10:00:00Z')
			)
		).toBe('changed_here');
		expect(await roleOf(seeded.employeeId)).toBe(roles.manager);
	});

	it('two linked organizations of one tenant: the ADMIN stays while either still says admin', async () => {
		const second = await addOrganization();
		await addLink(second, LINK_B);
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();

		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('role_granted');
		expect(await sync.apply(envelope('01JD0000000000000000000002', 'created', { tenant_link_id: LINK_B }))).toBe(
			'added'
		);
		expect(await memberships(second, seeded.employeeId)).toEqual([true]);
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);

		expect(await sync.apply(envelope('01JD0000000000000000000003', 'removed', {}, '2026-11-03T10:00:00Z'))).toBe(
			'removed'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		expect(await memberships(seeded.organizationId, seeded.employeeId)).toEqual([false]);

		expect(
			await sync.apply(
				envelope(
					'01JD0000000000000000000004',
					'role_changed',
					{ tenant_link_id: LINK_B, role: 'member' },
					'2026-11-04T10:00:00Z'
				)
			)
		).toBe('role_revoked');
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it('all or nothing: when the audit row cannot be written, the change is rolled back and applied on the retry', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const failing = Object.create(audit) as EverConnectAuditService;
		failing.record = async () => {
			throw new Error('audit unavailable');
		};
		const added = envelope('01JD0000000000000000000001', 'created');
		await expect(new MembershipSyncHandler(dataSource, store, failing, ON).apply(added)).rejects.toThrow(
			'audit unavailable'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await syncRows()).toEqual([]);
		// The feed reads it again: granted by the sync, so a later demotion takes it back.
		expect(await handler().apply(added)).toBe('role_granted');
		expect(
			await handler().apply(envelope('01JD0000000000000000000002', 'removed', {}, '2026-11-03T10:00:00Z'))
		).toBe('removed');
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it("each organization's own last change counts, however many changes the other one had since", async () => {
		const second = await addOrganization();
		await addLink(second, LINK_B);
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('role_granted');
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000002', 'created', { tenant_link_id: LINK_B, role: 'member' })
			)
		).toBe('added');
		for (let n = 0; n < 30; n++) {
			const id = `01JD00000000000000000001${String(n).padStart(2, '0')}`;
			const at = new Date(Date.parse('2026-11-03T00:00:00Z') + n * 60_000).toISOString();
			const role = n % 2 ? 'member' : 'admin';
			await sync.apply(envelope(id, 'role_changed', { tenant_link_id: LINK_B, role }, at));
		}
		expect(await roleOf(seeded.employeeId)).toBe(roles.admin);
		// The last change of the second organization was "member": the first one's grant is the only one left.
		expect(await sync.apply(envelope('01JD0000000000000000000300', 'removed', {}, '2026-11-04T10:00:00Z'))).toBe(
			'removed'
		);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
	});

	it('only a person linked to a Gauzy user of the tenant: no user is created, nobody else changes', async () => {
		const users = await userCount();
		const sync = handler();
		// No Ever ID link at all.
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created'))).toBe('person_unknown');
		// Linked to another issuer.
		await linkEverId(seeded.employeeId, 'sub-bob', 'https://other.example.test');
		expect(await sync.apply(envelope('01JD0000000000000000000002', 'created'))).toBe('person_unknown');
		// Linked, but Ever Platform's person link names another user.
		await linkEverId(seeded.employeeId, 'sub-bob', `${ISSUER}/`);
		expect(
			await sync.apply(
				envelope('01JD0000000000000000000003', 'created', { product_user_ref: seeded.superAdminId })
			)
		).toBe('person_mismatch');
		expect(await userCount()).toBe(users);
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await syncRows()).toEqual([]);
		// The issuer spelled with a trailing slash is the same issuer, and the user it names is that user.
		expect(
			await sync.apply(envelope('01JD0000000000000000000004', 'created', { product_user_ref: seeded.employeeId }))
		).toBe('role_granted');
	});

	it('an unknown role, a malformed event, or a link that is not live change nothing', async () => {
		await linkEverId(seeded.employeeId, 'sub-bob');
		const sync = handler();
		expect(await sync.apply(envelope('01JD0000000000000000000001', 'created', { role: 'billing' }))).toBe(
			'role_unknown'
		);
		expect(await sync.apply(envelope('not-a-ulid', 'created'))).toBe('malformed');
		expect(
			await sync.apply(envelope('01JD0000000000000000000002', 'created', { identity_issuer: 'http://x.test' }))
		).toBe('malformed');
		expect(await sync.apply(envelope('01JD0000000000000000000003', 'created', { tenant_link_id: LINK_B }))).toBe(
			'link_unknown'
		);
		await store.updateLink(LINK, { status: 'suspended' });
		expect(await sync.apply(envelope('01JD0000000000000000000004', 'created'))).toBe('link_unknown');
		expect(await roleOf(seeded.employeeId)).toBe(roles.employee);
		expect(await syncRows()).toEqual([]);
	});
});
