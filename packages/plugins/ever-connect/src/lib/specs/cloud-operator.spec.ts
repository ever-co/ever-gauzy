import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { readEverConnectConfig } from '../ever-connect-config';
import { EverConnectConnectionService } from '../ever-connect-connection.service';
import { EverConnectLinkService, INSTALLATION_LINKS_SHOWN } from '../ever-connect-link.service';
import { EverConnectOperatorService } from '../ever-connect-operator.service';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore } from '../ever-connect.store';
import { INSTANCE_ID } from '../fixtures/identity-harness';
import { createCoreTables, migrateUp, openTestDataSource } from '../fixtures/test-db';
import { EverConnectOperatorGuard } from '../guards/ever-connect-operator.guard';

const OPS = '2f0d6a52-6a0f-4a8e-9d3c-4b7d9e1f0a11';
const TENANT_ADMIN = '7c1e4a3b-0d2f-4e5a-8b9c-1a2b3c4d5e6f';
const CLOUD = { EVER_CONNECT_ENABLED: 'true', EVER_INSTALL_SOURCE: 'cloud', EVER_CONNECT_CLOUD_OPERATOR_USER_IDS: OPS };

/** The shared operator check: the installation's operator is `TENANT_ADMIN`; a listed id is a super admin. */
function sharedOperator() {
	return {
		isOperator: jest.fn(async (user: { id?: string } | null | undefined) => user?.id === TENANT_ADMIN),
		isListedSuperAdmin: jest.fn(
			async (user: { id?: string } | null | undefined, role: string | null | undefined, ids: ReadonlyArray<string>) =>
				role === 'SUPER_ADMIN' && !!user?.id && ids.includes(user.id)
		)
	};
}

const requestOf = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
const superAdmin = (id: string) => ({ id, role: { name: 'SUPER_ADMIN' } });

/**
 * Ever's cloud names the operators of its connection by user id (`EVER_CONNECT_CLOUD_OPERATOR_USER_IDS`):
 * they get the Connection tab and its routes; every other tenant's super admin keeps getting 404, and
 * without the list nobody does, as before. Elsewhere the installation's operator is unchanged.
 */
describe('the operator of the connection on Ever cloud', () => {
	it('on Ever cloud: only a super admin listed by id; the installation operator check is not asked', async () => {
		const shared = sharedOperator();
		const operator = new EverConnectOperatorService(shared as never, readEverConnectConfig(CLOUD));
		expect(await operator.isOperator(superAdmin(OPS), 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(superAdmin(TENANT_ADMIN), 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(superAdmin(OPS), 'ADMIN')).toBe(false);
		expect(shared.isOperator).not.toHaveBeenCalled();
		expect(shared.isListedSuperAdmin).toHaveBeenCalledWith(superAdmin(OPS), 'SUPER_ADMIN', [OPS]);
	});

	it('on Ever cloud without the list: nobody', async () => {
		const shared = sharedOperator();
		const config = readEverConnectConfig({ EVER_INSTALL_SOURCE: 'cloud' });
		const operator = new EverConnectOperatorService(shared as never, config);
		expect(await operator.isOperator(superAdmin(OPS), 'SUPER_ADMIN')).toBe(false);
		expect(await operator.isOperator(superAdmin(TENANT_ADMIN), 'SUPER_ADMIN')).toBe(false);
	});

	it('self-hosted: the installation operator, whatever the cloud list says', async () => {
		const shared = sharedOperator();
		const config = readEverConnectConfig({ EVER_CONNECT_CLOUD_OPERATOR_USER_IDS: OPS });
		const operator = new EverConnectOperatorService(shared as never, config);
		expect(await operator.isOperator(superAdmin(TENANT_ADMIN), 'SUPER_ADMIN')).toBe(true);
		expect(await operator.isOperator(superAdmin(OPS), 'SUPER_ADMIN')).toBe(false);
		expect(shared.isListedSuperAdmin).not.toHaveBeenCalled();
	});

	it('the guard: the listed operator passes; anyone else, and everyone once the module is off, gets 404', async () => {
		const operator = new EverConnectOperatorService(sharedOperator() as never, readEverConnectConfig(CLOUD));
		const guard = new EverConnectOperatorGuard(operator, CLOUD);
		await expect(guard.canActivate(requestOf(superAdmin(OPS)))).resolves.toBe(true);
		await expect(guard.canActivate(requestOf(superAdmin(TENANT_ADMIN)))).rejects.toBeInstanceOf(NotFoundException);
		await expect(guard.canActivate(requestOf(undefined))).rejects.toBeInstanceOf(NotFoundException);
		const off = new EverConnectOperatorGuard(operator, { ...CLOUD, EVER_CONNECT_ENABLED: 'false' });
		await expect(off.canActivate(requestOf(superAdmin(OPS)))).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The lifecycle the operator runs from the Connection tab, on the database: **Check again** finishes a
 * connection Ever Platform approved and audits who saw it; the tab lists the installation's links.
 */
describe('the connection lifecycle of the Connection tab', () => {
	let dataSource: DataSource;
	const clock = { t: Date.parse('2026-11-20T10:00:00.000Z'), now: () => clock.t };
	let store: EverConnectStore;
	let audit: EverConnectAuditService;

	beforeEach(async () => {
		dataSource = await openTestDataSource({ name: 'better-sqlite3' });
		await createCoreTables(dataSource, 'better-sqlite3');
		await migrateUp(dataSource);
		store = new EverConnectStore(dataSource, clock);
		audit = new EverConnectAuditService(dataSource, clock);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	function connectionService(instanceStatus: string) {
		const self = jest.fn(async () => ({ instance: { status: instanceStatus }, tenant_links: [] }));
		const platform = { getClient: async () => ({ instances: { self } }), setRegistryInstanceId: jest.fn() };
		const entitlements = {
			fetchInstanceDocument: jest.fn(async () => ({ seq: 1 })),
			storeInstanceDocument: jest.fn(async () => undefined)
		};
		const states = { sync: jest.fn(async () => undefined) };
		const signals = new EverConnectSignals();
		const connected = jest.fn();
		signals.connected$.subscribe(connected);
		const service = new EverConnectConnectionService(
			platform as never,
			store,
			audit,
			entitlements as never,
			states as never,
			{} as never,
			signals,
			{} as never,
			readEverConnectConfig(CLOUD),
			CLOUD,
			clock
		);
		return { service, self, entitlements, connected };
	}

	const auditRows = async () =>
		(
			(await dataSource.query(
				'SELECT "action", "actorLabel", "actorUserId", "details" FROM "ever_connect_audit" ORDER BY "at" ASC'
			)) as Array<{ action: string; actorLabel: string; actorUserId: string | null; details: string }>
		).map((row) => ({ ...row, details: JSON.parse(row.details) }));

	it('Check again: once Ever Platform approved it, the connection is finished and audited with the operator', async () => {
		await store.updateConnection({
			status: 'pending_approval',
			platformInstanceId: INSTANCE_ID,
			kid: 'kid-1',
			connectedAt: clock.now()
		});
		const { service, self, entitlements, connected } = connectionService('active');
		expect(await service.checkApproval({ actorLabel: 'operator', userId: OPS })).toBe('connected');
		expect(self).toHaveBeenCalledTimes(1);
		expect(entitlements.storeInstanceDocument).toHaveBeenCalledTimes(1);
		expect(connected).toHaveBeenCalledTimes(1);
		expect(await auditRows()).toEqual([
			{
				action: 'instance.connect',
				actorLabel: 'operator',
				actorUserId: OPS,
				details: { platform_instance_id: INSTANCE_ID, kid: 'kid-1', status: 'connected', source: 'approval' }
			}
		]);
	});

	it('Check again while it still waits: nothing changes and nothing is audited', async () => {
		await store.updateConnection({ status: 'pending_approval', platformInstanceId: INSTANCE_ID, kid: 'kid-1' });
		const { service, connected } = connectionService('pending_approval');
		expect(await service.checkApproval({ actorLabel: 'operator', userId: OPS })).toBe('pending_approval');
		expect(connected).not.toHaveBeenCalled();
		expect(await auditRows()).toEqual([]);
	});

	it('Check again on a connection that is not waiting: answered as it is, without a request', async () => {
		await store.updateConnection({ status: 'disconnected' });
		const { service, self } = connectionService('active');
		expect(await service.checkApproval({ actorLabel: 'operator', userId: OPS })).toBe('disconnected');
		expect(self).not.toHaveBeenCalled();
	});

	it("an approval read from Ever Platform's feed is audited as the platform's", async () => {
		await store.updateConnection({ status: 'pending_approval', platformInstanceId: INSTANCE_ID, kid: 'kid-1' });
		const { service } = connectionService('active');
		await service.approved();
		expect((await auditRows()).map((row) => [row.action, row.actorLabel, row.actorUserId])).toEqual([
			['instance.connect', 'platform', null]
		]);
	});

	it("the installation's links: live ones only, newest first, at most the shown number, without Gauzy ids", async () => {
		const links = new EverConnectLinkService({} as never, store, audit, {} as never, {} as never, new EverConnectSignals());
		expect(await links.installationLinks()).toEqual({ total: 0, items: [] });
		const add = async (n: number, status: 'linked' | 'suspended' | 'unlinked') => {
			clock.t += 1_000;
			const link = await store.insertLink({
				tenantId: randomUUID(),
				organizationId: randomUUID(),
				integrationTenantId: null,
				linkId: `01JNE7V9J03J6XQ2WN8H0Z${String(n).padStart(4, '0')}`,
				everOrgId: `01JNE7V9J03J6XQ2WN8H0Y${String(n).padStart(4, '0')}`,
				everHandle: `org-${n}`,
				status: status === 'unlinked' ? 'linked' : status,
				entitlementJwsEncrypted: null,
				entitlementSeq: null,
				entitlementIat: null,
				entitlementExp: null,
				entitlementFetchedAt: null
			});
			if (status === 'unlinked') {
				await store.updateLink(link.linkId, { status: 'unlinked', unlinkedAt: clock.now() });
			}
		};
		await add(1, 'linked');
		await add(2, 'unlinked');
		await add(3, 'suspended');
		const listed = await links.installationLinks();
		expect(listed.total).toBe(2);
		expect(listed.items.map((item) => [item.handle, item.status])).toEqual([
			['org-3', 'suspended'],
			['org-1', 'linked']
		]);
		expect(Object.keys(listed.items[0]).sort()).toEqual(['ever_org_id', 'handle', 'link_id', 'linked_at', 'status']);
		for (let n = 4; n < 4 + INSTALLATION_LINKS_SHOWN; n++) await add(n, 'linked');
		const many = await links.installationLinks();
		expect(many.total).toBe(INSTALLATION_LINKS_SHOWN + 2);
		expect(many.items).toHaveLength(INSTALLATION_LINKS_SHOWN);
		expect(many.items[0].handle).toBe(`org-${3 + INSTALLATION_LINKS_SHOWN}`);
	});
});
