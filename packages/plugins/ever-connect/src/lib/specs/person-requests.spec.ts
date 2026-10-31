import { createHash, verify as edVerify } from 'node:crypto';
import { EverConnectScheduler } from '../ever-connect-scheduler.service';
import { EverConnectSignals } from '../ever-connect-signals';
import { URL_CHECK_AUDIENCE, URL_CHECK_MAX_S } from '../ever-connect.constants';
import { FakeAccounts, identityHarness, IdentityHarness, INSTANCE_ID, ISSUER, problem } from '../fixtures/identity-harness';
import { PersonDeletionHandler } from '../handlers/person-deletion.handler';
import { PersonExportHandler } from '../handlers/person-export.handler';
import { PersonRequestsHandler } from '../handlers/person-requests.handler';
import { PersonDataParticipantPort } from '../ports/person-data-participant.port';
import { EventEnvelope } from '../sdk';
import { EverConnectWellKnownService, WELL_KNOWN_PATH } from '../well-known/ever-connect-well-known.service';

/**
 * A person's deletion and export requests from the event feed, answered with
 * `POST /v1/instances/me/ack` through the real SDK client (each answer body checked against the
 * SDK's request schema before it is sent): handled once per event id (a replayed page sends one
 * answer), the Ever ID links removed for a deletion, `failed` with a reason code while no
 * personal-data participant is bound, `no_account` when nothing is linked, and an answer that could
 * not be sent is sent again. Also `/.well-known/ever-connect`: 404 by default, a valid statement
 * during an address check.
 */
describe('A person\'s requests and /.well-known/ever-connect', () => {
	let h: IdentityHarness;
	let accounts: FakeAccounts;
	const ACK = 'POST /v1/instances/me/ack';
	const SUBJECT = '275396402232829475';
	const HASH = createHash('sha256').update(`${ISSUER}#${SUBJECT}`).digest('hex');

	beforeEach(async () => {
		h = await identityHarness();
		accounts = new FakeAccounts();
		h.platform.on(ACK, { status: 204 });
		await h.connectAndEnable();
	});

	afterEach(async () => {
		await h.close();
	});

	function handler(participant?: PersonDataParticipantPort, withAccounts = true) {
		const port = withAccounts ? accounts : undefined;
		return new PersonRequestsHandler(
			h.identity,
			h.platformService as never,
			new PersonDeletionHandler(h.identity, port, participant),
			new PersonExportHandler(port, participant),
			h.audit,
			h.signals,
			port,
			{ ENCRYPTION_KEY: 'identity-spec-encryption-key-0123456789' },
			h.clock
		);
	}

	/** An event as the SDK's feed fixtures write it, for this installation. */
	const envelope = (type: 'deletion' | 'export', id: string, data: Record<string, unknown> = {}): EventEnvelope =>
		({
			id,
			type: `ever.registry.person.${type}_requested`,
			version: 1,
			occurred_at: '2026-11-02T10:00:00Z',
			subject: { kind: 'person', id: '01J2Z0VY8P767S5J1R1HKPQVJ0' },
			org_id: '01JNB79NZW2S85GF4A96MMX6BT',
			instance_id: INSTANCE_ID,
			actor: { kind: 'system', id: 'platform' },
			data: {
				person_id: '01JDFTGFSNB2G7Z8BK54MS1VY1',
				job_id: '01JSF0AY2MRHJXQBQWY8CW44MM',
				respond_by: '2026-11-09T10:00:00Z',
				...(type === 'deletion' ? { subject_hash: HASH } : {}),
				subject_hashes: [HASH],
				...data
			}
		}) as never;

	const linkPerson = () =>
		accounts.add({ userId: 'user-1', tenantId: 't1', tenantName: 'Acme', issuer: ISSUER, subject: SUBJECT, linkMethod: 'explicit' });

	describe('deletion', () => {
		it('removes the links, then answers failed (account_deletion_pending) while no participant is bound', async () => {
			linkPerson();
			expect(await handler().handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC77'))).toBe(true);
			expect(accounts.links_).toEqual([]);
			expect(accounts.erased).toEqual([[HASH]]);
			expect(h.platform.callsTo(ACK).map((c) => c.body)).toEqual([
				{ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'failed', detail: { reason_code: 'account_deletion_pending' } }
			]);
		});

		it('a replayed envelope sends one answer', async () => {
			linkPerson();
			const requests = handler();
			const event = envelope('deletion', '01JJYMM5DB8395H7EH8359HC77');
			await requests.handle(event);
			await requests.handle(event);
			// Another API process reading the same page.
			await handler().handle(event);
			expect(h.platform.callsTo(ACK)).toHaveLength(1);
		});

		it('removes the link reports of the identities (nothing more of them is sent or kept)', async () => {
			linkPerson();
			await h.identity.addReport({
				id: 'report-1',
				op: 'link',
				userId: 'user-1',
				tenantId: 't1',
				tenantName: 'Acme',
				issuer: ISSUER,
				subject: SUBJECT,
				subjectHash: HASH,
				linkMethod: 'explicit'
			});
			await handler().handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7H'));
			expect(await h.dataSource.query('SELECT * FROM "ever_connect_person_link_report"')).toEqual([]);
			expect(accounts.sessionsEnded).toEqual([['user-1']]);
		});

		it('a handling that stopped after the links were removed is taken up again for the same accounts, never no_account', async () => {
			linkPerson();
			const requests = handler();
			let failures = 0;
			const update = h.identity.updateClaimedRequest.bind(h.identity);
			jest.spyOn(h.identity, 'updateClaimedRequest').mockImplementation(async (id, token, values, until) => {
				if ('result' in values && failures++ === 0) throw new Error('database went away');
				return update(id, token, values, until);
			});
			const event = envelope('deletion', '01JJYMM5DB8395H7EH8359HC7J');
			await expect(requests.handle(event)).rejects.toThrow('database went away');
			expect(accounts.links_).toEqual([]);
			// Read again at once (another page): held by the first attempt, nothing is answered twice.
			await requests.handle(event);
			expect(h.platform.callsTo(ACK)).toEqual([]);
			// Once the hold ran out, the worker takes it up: same accounts, honest answer.
			h.clock.t += 3 * 60_000;
			expect(await requests.resumeDue()).toBe(1);
			expect(h.platform.callsTo(ACK).map((c) => c.body)).toEqual([
				{ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'failed', detail: { reason_code: 'account_deletion_pending' } }
			]);
			expect(accounts.sessionsEnded.at(-1)).toEqual(['user-1']);
			expect(await requests.resumeDue()).toBe(0);
		});

		it('a user linked after the first lookup is recorded on the request before their link goes', async () => {
			linkPerson();
			const requests = handler();
			const event = envelope('deletion', '01JJYMM5DB8395H7EH8359HC7N');
			// Another account links the identity between the lookup and the erase.
			const findUsers = accounts.findUsers.bind(accounts);
			jest.spyOn(accounts, 'findUsers').mockImplementationOnce(async (hashes) => {
				const found = await findUsers(hashes);
				accounts.add({ userId: 'user-2', tenantId: 't2', tenantName: 'Zephyr', issuer: ISSUER, subject: SUBJECT, linkMethod: 'explicit' });
				return found;
			});
			await requests.handle(event);
			const [row] = await h.dataSource.query('SELECT "userIds" FROM "ever_connect_person_request"');
			expect(JSON.parse(row.userIds).sort()).toEqual(['user-1', 'user-2']);
			expect(h.platform.callsTo(ACK)[0].body).toMatchObject({ result: 'failed' });
		});

		it('answers no_account when nothing here is linked to the person', async () => {
			await handler().handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC78'));
			expect(h.platform.callsTo(ACK)[0].body).toEqual({ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'no_account' });
		});

		it('a bound participant answers deleted or anonymised for the linked users', async () => {
			linkPerson();
			const participant = {
				deletePersonData: jest.fn().mockResolvedValue({ result: 'anonymised' }),
				exportPersonData: jest.fn()
			};
			await handler(participant).handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC79'));
			expect(participant.deletePersonData).toHaveBeenCalledWith({ userIds: ['user-1'], jobId: '01JSF0AY2MRHJXQBQWY8CW44MM' });
			expect(h.platform.callsTo(ACK)[0].body).toEqual({ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'anonymised' });
		});

		it('retained_legal goes with its legal basis (checked against the SDK request schema before it is sent)', async () => {
			linkPerson();
			const participant = {
				deletePersonData: jest.fn().mockResolvedValue({ result: 'retained_legal', legalBasis: 'HGB 257 (commercial records, 10 years)' }),
				exportPersonData: jest.fn()
			};
			await handler(participant).handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7M'));
			expect(h.platform.callsTo(ACK)[0].body).toEqual({
				job_id: '01JSF0AY2MRHJXQBQWY8CW44MM',
				result: 'retained_legal',
				legal_basis: 'HGB 257 (commercial records, 10 years)'
			});
			const [row] = await h.dataSource.query('SELECT "state" FROM "ever_connect_person_request"');
			expect(row.state).toBe('answered');
		});

		it('without the Ever ID sign-in plugin the links cannot be looked up: failed, never no_account', async () => {
			await handler(undefined, false).handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7A'));
			expect(h.platform.callsTo(ACK)[0].body).toMatchObject({ result: 'failed', detail: { reason_code: 'account_deletion_pending' } });
		});
	});

	describe('export', () => {
		it('answers failed (export_not_available) while no participant is bound; no_account when nothing is linked', async () => {
			linkPerson();
			await handler().handle(envelope('export', '01JJAB6CHJ38V4DDGBQTCEH6RN'));
			await handler().handle(envelope('export', '01JJAB6CHJ38V4DDGBQTCEH6RP', { subject_hashes: ['a'.repeat(64)] }));
			expect(h.platform.callsTo(ACK).map((c) => c.body)).toEqual([
				{ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'failed', detail: { reason_code: 'export_not_available' } },
				{ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'no_account' }
			]);
			// An export removes nothing.
			expect(accounts.links_).toHaveLength(1);
		});

		it('a bound participant answers exported with its https link, stored sealed', async () => {
			linkPerson();
			const url = 'https://gauzy.example.com/exports/abc';
			const participant = {
				deletePersonData: jest.fn(),
				exportPersonData: jest.fn().mockResolvedValue({ result: 'exported', exportUrl: url })
			};
			await handler(participant).handle(envelope('export', '01JJAB6CHJ38V4DDGBQTCEH6RQ'));
			expect(h.platform.callsTo(ACK)[0].body).toEqual({ job_id: '01JSF0AY2MRHJXQBQWY8CW44MM', result: 'exported', export_url: url });
			expect(JSON.stringify(await h.dataSource.query('SELECT * FROM "ever_connect_person_request"'))).not.toContain(url);
		});
	});

	it('an answer that could not be sent is sent again later; a final answer refused as final is done', async () => {
		linkPerson();
		const requests = handler();
		h.platform.offline = true;
		await requests.handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7B'));
		let [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_request"');
		expect(row.state).toBe('pending');
		h.platform.offline = false;
		expect(await requests.sendDue()).toBe(0);
		h.clock.t = Number(row.nextAttemptAt);
		h.platform.on(ACK, problem(409, 'receipt_final'));
		expect(await requests.sendDue()).toBe(1);
		[row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_request"');
		expect(row.state).toBe('answered');
		expect(await requests.sendDue()).toBe(0);
	});

	it('a handling that lost its claim (it ran too long) does not overwrite the answer of the one that took over', async () => {
		linkPerson();
		let release: () => void = () => undefined;
		const slow = {
			deletePersonData: jest.fn(
				() => new Promise<{ result: 'deleted' }>((resolve) => (release = () => resolve({ result: 'deleted' })))
			),
			exportPersonData: jest.fn()
		};
		const first = handler(slow);
		const event = envelope('deletion', '01JJYMM5DB8395H7EH8359HC7K');
		const running = first.handle(event);
		while (!slow.deletePersonData.mock.calls.length) {
			await new Promise((resolve) => setImmediate(resolve));
		}
		// The claim ran out (no renewal reached the database): another handling takes over and answers.
		await h.dataSource.query(`UPDATE "ever_connect_person_request" SET "claimedUntil" = 0`);
		h.clock.t += 3 * 60_000;
		expect(await handler().resumeDue()).toBe(1);
		release();
		await running;
		expect(h.platform.callsTo(ACK).map((c) => c.body?.['result'])).toEqual(['failed']);
	});

	it('a request Ever Platform does not have for this installation is not sent again', async () => {
		h.platform.on(ACK, problem(404, 'not_found'));
		const requests = handler();
		await requests.handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7C'));
		const [row] = await h.dataSource.query('SELECT * FROM "ever_connect_person_request"');
		expect(row.state).toBe('rejected');
		h.clock.t += 365 * 24 * 3_600_000;
		await requests.sendDue();
		expect(h.platform.callsTo(ACK)).toHaveLength(1);
	});

	it('the audit holds the job, the answer and a count, never a subject or a person', async () => {
		linkPerson();
		await handler().handle(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7D'));
		const audit = JSON.stringify(await h.auditRows());
		expect(audit).toContain('person_request.answer');
		expect(audit).not.toContain(SUBJECT);
		expect(audit).not.toContain(HASH);
		expect(audit).not.toContain('01JDFTGFSNB2G7Z8BK54MS1VY1');
	});

	it('the feed dispatcher hands the two types to the handler; a request of another installation is ignored', async () => {
		const requests = { handle: jest.fn().mockResolvedValue(true) };
		const store = { connection: jest.fn() };
		const scheduler = new EverConnectScheduler(
			{} as never,
			store as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			new EverConnectSignals(),
			{ feedMode: 'interval' } as never,
			undefined,
			requests as never
		);
		const ours = { platformInstanceId: INSTANCE_ID, connectedAt: Date.parse('2026-11-01T00:00:00Z') };
		expect(await scheduler.dispatch(envelope('deletion', '01JJYMM5DB8395H7EH8359HC7E'), ours)).toBe('person');
		expect(await scheduler.dispatch(envelope('export', '01JJYMM5DB8395H7EH8359HC7F'), ours)).toBe('person');
		const other = { ...envelope('deletion', '01JJYMM5DB8395H7EH8359HC7G'), instance_id: '01JD00000000000000000THER1' } as never;
		expect(await scheduler.dispatch(other, ours)).toBe('ignored');
		expect(requests.handle).toHaveBeenCalledTimes(2);
	});

	describe('/.well-known/ever-connect', () => {
		function wellKnown(registered: Array<{ path: string; handler: (...args: unknown[]) => void }> = []) {
			const adapter = {
				get: (path: string, fn: (...args: unknown[]) => void) => registered.push({ path, handler: fn }),
				setHeader: jest.fn(),
				reply: jest.fn()
			};
			const instance = { connectSigner: async () => h.signer };
			const service = new EverConnectWellKnownService(h.store, instance as never, { httpAdapter: adapter } as never, h.clock);
			return { service, adapter, registered };
		}

		it('is registered outside /api and falls through to the not-found handler by default', async () => {
			const { service, adapter, registered } = wellKnown();
			service.onModuleInit();
			expect(registered.map((r) => r.path)).toEqual([WELL_KNOWN_PATH]);
			expect(WELL_KNOWN_PATH).toBe('/.well-known/ever-connect');
			const next = jest.fn();
			await new Promise<void>((resolve) => {
				registered[0].handler({}, {}, () => {
					next();
					resolve();
				});
			});
			expect(next).toHaveBeenCalled();
			expect(adapter.reply).not.toHaveBeenCalled();
		});

		it('answers a valid statement signed with the connection key during a check, and nothing after it', async () => {
			const { service } = wellKnown();
			expect(await service.statement()).toBeNull();
			await service.beginCheck('https://gauzy.example.com');
			const jws = (await service.statement()) as string;
			const [header, payload, signature] = jws.split('.');
			expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: h.signer.kid });
			const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
			expect(claims).toMatchObject({ iss: INSTANCE_ID, aud: URL_CHECK_AUDIENCE, url: 'https://gauzy.example.com' });
			expect(claims.exp - claims.iat).toBeLessThanOrEqual(URL_CHECK_MAX_S);
			expect(
				edVerify(null, Buffer.from(`${header}.${payload}`), h.signer.publicKey, Buffer.from(signature, 'base64url'))
			).toBe(true);

			h.clock.t += URL_CHECK_MAX_S * 1000;
			expect(await service.statement()).toBeNull();
			await service.beginCheck('https://gauzy.example.com');
			await service.endCheck();
			expect(await service.statement()).toBeNull();
			await expect(service.beginCheck('http://gauzy.example.com')).rejects.toThrow();
		});

		it('answers nothing when the installation is not connected', async () => {
			const { service } = wellKnown();
			await service.beginCheck('https://gauzy.example.com');
			await h.store.updateConnection({ status: 'disconnected' });
			expect(await service.statement()).toBeNull();
		});
	});
});
