import { createHash } from 'node:crypto';
import { EventBus } from '@gauzy/core';
import { ZitadelAccountLinkedEvent, ZitadelAccountUnlinkedEvent } from '@gauzy/plugin-auth-zitadel';
import { IDENTITY_RETRY_MAX_MS, OIDC_CLIENT_POLL_FIRST_MS } from '../ever-connect.constants';
import { FakeAccounts, identityHarness, IdentityHarness, ISSUER, problem } from '../fixtures/identity-harness';
import { insert } from '../fixtures/test-db';
import { PersonLinkReporter, retryDelay, tenantDisplayName } from '../reporters/person-link.reporter';

/**
 * The person-link reporter: an Ever ID link or unlink of a Gauzy user of a linked tenant becomes one
 * row of the retry table, sent by the lease holder (`POST`/`DELETE /v1/instances/me/person-links`)
 * with exactly the SDK's request body (identifiers only, never an e-mail address); a subject Ever
 * Platform does not know yet, or no answer, backs off to a day, then the report is given up and
 * audited; nothing is sent while Sign in with Ever ID is off; the links that existed before are
 * reported once when the client becomes ready, for the linked tenants only.
 */
describe('Sign in with Ever ID: the person-link reporter', () => {
	let h: IdentityHarness;
	let accounts: FakeAccounts;
	let bus: EventBus;
	let reporter: PersonLinkReporter;
	const TENANT = 'tenant-acme';
	const ORG = 'org-acme';
	const LINK = '01JD0000000000000000000MNK';
	const POST = 'POST /v1/instances/me/person-links';

	beforeEach(async () => {
		h = await identityHarness();
		accounts = new FakeAccounts();
		bus = new EventBus();
		reporter = new PersonLinkReporter(h.store, h.identity, h.platformService as never, h.everIdLogin, h.audit, h.signals, bus, accounts, h.clock);
		reporter.onModuleInit();
		// A linked tenant, and Sign in with Ever ID ready.
		await insert(h.dataSource, 'better-sqlite3', 'ever_connect_link', {
			id: 'row-1',
			tenantId: TENANT,
			organizationId: ORG,
			linkId: LINK,
			everOrgId: '01JD0000000000000000000ORG',
			status: 'linked',
			liveKey: `${TENANT}|${ORG}`,
			createdAt: h.clock.now(),
			updatedAt: h.clock.now()
		});
		h.platform.on('POST /v1/instances/me/oidc-client', { status: 202, body: { status: 'pending', job_id: null } });
		h.platform.on('GET /v1/instances/me/oidc-client', {
			status: 200,
			body: { status: 'ready', issuer: ISSUER, client_id: 'inst-x', client_secret: 'ics_s' }
		});
		h.platform.on(POST, (call) => ({ status: 201, body: { id: 'PL1', person_id: 'P1', instance_id: 'I', product_user_ref: call.body?.['product_user_ref'], link_method: 'explicit', linked_at: '2026-11-02T10:00:00Z' } }));
		h.platform.on('DELETE /v1/instances/me/person-links/user-1', { status: 204 });
		await h.connectAndEnable();
	});

	afterEach(async () => {
		reporter.onModuleDestroy();
		await h.close();
	});

	async function clientReady() {
		await h.everIdLogin.enabled();
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
		await h.everIdLogin.pollDue();
		// As the worker does once the client is ready.
		const due = await h.everIdLogin.backfillDue([TENANT]);
		if (due.length && (await reporter.backfill(due)) !== null) {
			await h.everIdLogin.markBackfilled(due);
		}
	}

	const payload = (overrides: Record<string, unknown> = {}) => ({
		userId: 'user-1',
		tenantId: TENANT,
		tenantName: 'Acme',
		issuer: ISSUER,
		subject: '275396402232829475',
		linkMethod: 'explicit' as const,
		everPersonId: 'P1',
		...overrides
	});

	/** The Ever ID sign-in plugin made the link (its table holds it). */
	const hold = (overrides: Record<string, unknown> = {}) => {
		const p = payload(overrides);
		accounts.add({ userId: p.userId, tenantId: p.tenantId, tenantName: p.tenantName, issuer: p.issuer, subject: p.subject, linkMethod: p.linkMethod });
		return p;
	};

	/** Lets the event bus subscribers run. */
	const settle = () => reporter.settled();

	it('a link on the event bus is reported once, with the SDK request body and no e-mail key', async () => {
		await clientReady();
		await bus.publish(new ZitadelAccountLinkedEvent(hold() as never));
		await settle();
		expect(await reporter.sendDue()).toBe(1);
		const [call] = h.platform.callsTo(POST);
		expect(call.body).toEqual({
			product_user_ref: 'user-1',
			identity_issuer: ISSUER,
			identity_subject: '275396402232829475',
			link_method: 'explicit',
			product_tenant_id: TENANT,
			product_org_id: ORG,
			tenant_link_id: LINK,
			display_name: 'Acme'
		});
		expect(JSON.stringify(call.body)).not.toMatch(/mail|@/);
		const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		expect(call.headers['idempotency-key']).toBe(createHash('sha256').update(row.id).digest('hex'));
		expect(row.state).toBe('sent');
		expect(row.subjectHash).toBe(createHash('sha256').update(`${ISSUER}#275396402232829475`).digest('hex'));
		// Nothing more is due.
		expect(await reporter.sendDue()).toBe(0);
		expect(h.platform.callsTo(POST)).toHaveLength(1);
	});

	it('an unlink is reported with DELETE by the Gauzy user id', async () => {
		await clientReady();
		await bus.publish(new ZitadelAccountUnlinkedEvent(payload() as never));
		await settle();
		await reporter.sendDue();
		expect(h.platform.callsTo('DELETE /v1/instances/me/person-links/user-1')).toHaveLength(1);
	});

	it('nothing is reported while Sign in with Ever ID is off, for another issuer, a provisioned link or an unlinked tenant', async () => {
		// Off: no client yet.
		expect(await reporter.linked(payload() as never)).toBe(false);
		await clientReady();
		expect(await reporter.linked(payload({ issuer: 'https://login.acme.example' }) as never)).toBe(false);
		expect(await reporter.linked(payload({ linkMethod: 'provisioned' }) as never)).toBe(false);
		expect(await reporter.linked(payload({ tenantId: 'tenant-not-linked' }) as never)).toBe(false);
		await h.store.updateConnection({ status: 'disconnected' });
		expect(await reporter.linked(payload() as never)).toBe(false);
		expect(await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"')).toEqual([]);
	});

	it('a report queued before the integration was switched off is dropped, not sent', async () => {
		await clientReady();
		await reporter.linked(payload() as never);
		await h.store.saveIntegration('instance', 'ever_id_login', { state: 'disabled', enabled: false });
		expect(await reporter.sendDue()).toBe(0);
		expect(h.platform.callsTo(POST)).toEqual([]);
		const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		expect(row.state).toBe('dropped');
	});

	it('422 subject_unknown backs off to a day, then the report is given up and audited', async () => {
		await clientReady();
		h.platform.on(POST, problem(422, 'subject_unknown'));
		await reporter.linked(hold() as never);
		let sends = 0;
		for (let i = 0; i < 40; i++) {
			await reporter.sendDue();
			sends = h.platform.callsTo(POST).length;
			const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
			if (row.state !== 'pending') break;
			expect(Number(row.nextAttemptAt) - h.clock.now()).toBeLessThanOrEqual(IDENTITY_RETRY_MAX_MS);
			h.clock.t = Number(row.nextAttemptAt);
		}
		const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		expect(row.state).toBe('failed');
		expect(row.lastError).toBe('422_subject_unknown');
		// Retried until the wait before an attempt was a day (30 s doubling, capped at a day).
		expect(sends).toBe(14);
		expect(retryDelay(13)).toBe(IDENTITY_RETRY_MAX_MS);
		const audit = await h.auditRows();
		expect(audit.filter((r) => r.action === 'person_link.report' && r.details['state'] === 'failed')).toHaveLength(1);
	});

	it('Ever Platform not answering is retried; a 403 (not enabled there) drops the report', async () => {
		await clientReady();
		await reporter.linked(hold() as never);
		h.platform.offline = true;
		await reporter.sendDue();
		let [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		expect(row.state).toBe('pending');
		expect(Number(row.attempts)).toBe(1);
		h.platform.offline = false;
		h.platform.on(POST, problem(403, 'integration_disabled'));
		h.clock.t = Number(row.nextAttemptAt);
		await reporter.sendDue();
		[row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		expect(row.state).toBe('dropped');
	});

	it('an unlink supersedes a link not sent yet (and the other way round)', async () => {
		await clientReady();
		await reporter.linked(payload() as never);
		await reporter.unlinked(payload() as never);
		await reporter.sendDue();
		expect(h.platform.callsTo(POST)).toEqual([]);
		expect(h.platform.callsTo('DELETE /v1/instances/me/person-links/user-1')).toHaveLength(1);
	});

	it('when the client becomes ready, the existing links of linked tenants only are reported once', async () => {
		accounts.add({ userId: 'user-1', tenantId: TENANT, tenantName: 'Acme', issuer: ISSUER, subject: 's1', linkMethod: 'confirmed' });
		accounts.add({ userId: 'user-2', tenantId: TENANT, tenantName: 'Acme', issuer: ISSUER, subject: 's2', linkMethod: 'signup' });
		accounts.add({ userId: 'user-3', tenantId: TENANT, tenantName: 'Acme', issuer: 'https://login.acme.example', subject: 's3', linkMethod: 'explicit' });
		accounts.add({ userId: 'user-4', tenantId: 'tenant-not-linked', tenantName: 'Other', issuer: ISSUER, subject: 's4', linkMethod: 'explicit' });
		await clientReady();
		const rows = await h.dataSource.query('SELECT "userId", "linkMethod" FROM "ever_connect_person_link_report" ORDER BY "userId"');
		expect(rows).toEqual([
			{ userId: 'user-1', linkMethod: 'confirmed' },
			{ userId: 'user-2', linkMethod: 'explicit' }
		]);
		// Ready again (re-read): nothing reported twice.
		expect(await reporter.backfill()).toBe(0);
	});

	it('one user\'s reports go in order: a newer one waits while an older one is retried', async () => {
		await clientReady();
		h.platform.offline = true;
		await reporter.unlinked(payload({ subject: 'identity-a' }) as never);
		await reporter.sendDue();
		h.clock.t += 1;
		h.platform.offline = false;
		await reporter.linked(hold({ subject: 'identity-b' }) as never);
		// The unlink of A waits for its retry; the link of B waits behind it.
		expect(await reporter.sendDue()).toBe(0);
		expect(h.platform.callsTo(POST)).toEqual([]);
		h.clock.t += 60_000;
		expect(await reporter.sendDue()).toBe(1);
		expect(await reporter.sendDue()).toBe(1);
		const order = h.platform.calls.filter((c) => c.path.includes('person-links')).map((c) => c.method);
		expect(order).toEqual(['DELETE', 'DELETE', 'POST']);
	});

	it('the existing links are reported again when their latest report was an unlink', async () => {
		await clientReady();
		await reporter.linked(payload() as never);
		await reporter.sendDue();
		h.clock.t += 1;
		await reporter.unlinked(payload() as never);
		await reporter.sendDue();
		accounts.add({ userId: 'user-1', tenantId: TENANT, tenantName: 'Acme', issuer: ISSUER, subject: payload().subject, linkMethod: 'explicit' });
		h.clock.t += 1;
		expect(await reporter.backfill()).toBe(1);
		expect(await reporter.backfill()).toBe(0);
	});

	it('a report removed meanwhile (a person\'s deletion) is not sent', async () => {
		await clientReady();
		await reporter.linked(payload() as never);
		const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"');
		await h.identity.purgeReports([row.subjectHash]);
		expect(await reporter.sendDue()).toBe(0);
		expect(h.platform.callsTo(POST)).toEqual([]);
	});

	it('reports made in the same millisecond keep their order; the batch is never filled with reports that must wait', async () => {
		await clientReady();
		h.platform.offline = true;
		await reporter.unlinked(payload({ subject: 'identity-a' }) as never);
		await reporter.sendDue();
		h.platform.offline = false;
		// Same time as the unlink: its order key still puts it after the unlink.
		await reporter.linked(hold({ subject: 'identity-b' }) as never, h.clock.now());
		for (let i = 0; i < 60; i++) {
			await reporter.linked(hold({ userId: `waiting-${i}`, subject: `s-${i}` }) as never);
		}
		const [unlink] = await h.dataSource.query(`SELECT * FROM "ever_connect_person_link_report" WHERE "op" = 'unlink'`);
		h.clock.t = Number(unlink.nextAttemptAt);
		// Every other user's report goes; user-1's link waits for its unlink, which goes first.
		await reporter.sendDue();
		await reporter.sendDue();
		await reporter.sendDue();
		expect(h.platform.callsTo(POST)).toHaveLength(61);
		const userOne = h.platform.calls.filter((c) => c.path.endsWith('/user-1') || c.body?.['product_user_ref'] === 'user-1');
		expect(userOne.map((c) => c.method)).toEqual(['DELETE', 'DELETE', 'POST']);
	});

	it('each report goes as the link is when it is sent, whatever order the events came in', async () => {
		await clientReady();
		// Another API process reported the unlink first; this one still queues the older link.
		await reporter.linked(payload() as never);
		await reporter.sendDue();
		// The link does not exist (it was removed): Ever Platform is told so, not linked again.
		expect(h.platform.callsTo(POST)).toEqual([]);
		expect(h.platform.callsTo('DELETE /v1/instances/me/person-links/user-1')).toHaveLength(1);
		// And the other way round: an unlink queued for a link that exists again is sent as a link.
		h.clock.t += 1;
		hold();
		await reporter.unlinked(payload() as never);
		await reporter.sendDue();
		expect(h.platform.callsTo(POST)).toHaveLength(1);
		// A provisioned link (Ever Platform's own) is never reported.
		h.clock.t += 1;
		accounts.links_[0].linkMethod = 'provisioned';
		await reporter.unlinked(payload() as never);
		await reporter.sendDue();
		expect(h.platform.callsTo(POST)).toHaveLength(1);
	});

	it('an unlink (which removes every link of the user there) is followed by the user\'s other links again', async () => {
		await clientReady();
		hold({ subject: 'identity-a' });
		hold({ subject: 'identity-b' });
		accounts.remove('user-1', 'identity-a');
		await reporter.unlinked(payload({ subject: 'identity-a' }) as never);
		await reporter.sendDue();
		await reporter.sendDue();
		const sent = h.platform.calls.filter((c) => c.path.includes('person-links'));
		expect(sent.map((c) => `${c.method} ${c.body?.['identity_subject'] ?? ''}`.trim())).toEqual(['DELETE', 'POST identity-b']);
	});

	it('the other links are queued before the unlink goes, once however often it is retried', async () => {
		await clientReady();
		hold({ subject: 'identity-b' });
		await reporter.unlinked(payload({ subject: 'identity-a' }) as never);
		h.platform.offline = true;
		await reporter.sendDue();
		h.clock.t += 60_000;
		await reporter.sendDue();
		const rows = await h.dataSource.query(`SELECT "op", "subject", "state" FROM "ever_connect_person_link_report" ORDER BY "seq"`);
		expect(rows).toEqual([
			{ op: 'unlink', subject: 'identity-a', state: 'pending' },
			{ op: 'link', subject: 'identity-b', state: 'pending' }
		]);
		h.platform.offline = false;
		h.clock.t += 3_600_000;
		await reporter.sendDue();
		await reporter.sendDue();
		const sent = h.platform.calls.filter((c) => c.path.includes('person-links') && c.method === 'POST');
		expect(sent.map((c) => c.body?.['identity_subject'])).toEqual(['identity-b']);
	});

	it('a backfill that cannot run (no client yet) counts as nothing done', async () => {
		expect(await reporter.backfill()).toBeNull();
	});

	it('events are handled in the order they happened; an older event never undoes a newer report', async () => {
		await clientReady();
		const t0 = h.clock.now();
		// A later unlink was handled first (another API process): the earlier link is stale.
		expect(await reporter.unlinked(payload() as never, t0 + 10)).toBe(true);
		expect(await reporter.linked(payload() as never, t0 + 5)).toBe(false);
		const rows = await h.dataSource.query('SELECT "op", "state" FROM "ever_connect_person_link_report"');
		expect(rows).toEqual([{ op: 'unlink', state: 'pending' }]);
		// In one process, both events go through one queue in publish order.
		await bus.publish(new ZitadelAccountLinkedEvent(payload({ subject: 'other' }) as never));
		await bus.publish(new ZitadelAccountUnlinkedEvent(payload({ subject: 'other' }) as never));
		await settle();
		const other = await h.dataSource.query(`SELECT "op", "state" FROM "ever_connect_person_link_report" WHERE "subject" = 'other' ORDER BY "createdAt", rowid`);
		expect(other.map((r: { op: string }) => r.op)).toEqual(['link', 'unlink']);
		expect(other.find((r: { op: string }) => r.op === 'link').state).toBe('dropped');
	});

	it('the tenant name is sent only when it does not look like an e-mail address', () => {
		expect(tenantDisplayName('Acme Ltd')).toBe('Acme Ltd');
		expect(tenantDisplayName('jane@acme.example')).toBeNull();
		expect(tenantDisplayName('')).toBeNull();
		expect(tenantDisplayName('x'.repeat(200))).toHaveLength(120);
	});
});
