import { createHash } from 'node:crypto';
import { In, MoreThan } from 'typeorm';
import { AuthZitadelSettings } from '../auth-zitadel.config';
import { subjectHashOf, ZitadelPersonDataListener } from '../handlers/person-deletion.listener';
import { EverConnectConfigPort } from '../ports/ever-connect-config.port';
import { RESOLVE_TIMEOUT_MS, ZitadelClaimsService } from '../services/zitadel-claims.service';

/**
 * Ever Platform's view of an identity for a sign-in whose ID token carries none of the platform's
 * `urn:ever:*` claims: asked through the connected-instance port only then, only when the connection
 * plugin is loaded, read with the same strict rules as the claims, and never holding the sign-in up
 * (6 seconds at most; an error or no answer signs in without hints).
 *
 * Also the accounts port a person's deletion or export request uses: identities are matched by
 * `sha256(<issuer>#<subject>)`, their links removed and the Gauzy sessions opened through Ever ID
 * ended, and nothing is read for a malformed hash.
 */
describe('Ever ID sign-in: Ever Platform view of an identity', () => {
	const settings = { everConnectEnabled: true } as AuthZitadelSettings;
	const token = (claims: Record<string, unknown> = {}) => ({ issuer: 'https://auth.ever.co', subject: 'S1', claims });

	function port(resolveIdentity?: EverConnectConfigPort['resolveIdentity']): EverConnectConfigPort {
		return {
			getEverIdLoginConfig: jest.fn().mockResolvedValue(null),
			isEverIdLoginEnabled: jest.fn().mockResolvedValue(true),
			...(resolveIdentity ? { resolveIdentity } : {})
		};
	}

	it('asks when the token carries none of the platform claims, and reads the answer strictly', async () => {
		const resolveIdentity = jest.fn().mockResolvedValue({
			person: { id: 'P1' },
			identity: { kind: 'personal', enterprise_org_id: null },
			orgs_filtered: [{ id: 'O1', handle: 'acme', reason: 'sso_required' }, { handle: 'no-id' }]
		});
		const hints = await new ZitadelClaimsService(settings, port(resolveIdentity)).resolveFor(token({ email: 'x' }));
		expect(resolveIdentity).toHaveBeenCalledWith('https://auth.ever.co', 'S1');
		expect(hints).toEqual({
			personId: 'P1',
			identityKind: 'personal',
			enterpriseOrgId: undefined,
			filteredOrganizations: [{ id: 'O1', handle: 'acme', reason: 'sso_required' }]
		});
	});

	it('never asks when the token carries the platform claims, the connection plugin is off, or there is no port', async () => {
		const resolveIdentity = jest.fn();
		const withClaims = await new ZitadelClaimsService(settings, port(resolveIdentity)).resolveFor(
			token({ 'urn:ever:person_id': 'P9' })
		);
		expect(withClaims.personId).toBe('P9');
		await new ZitadelClaimsService({ everConnectEnabled: false } as AuthZitadelSettings, port(resolveIdentity)).resolveFor(token());
		await new ZitadelClaimsService(settings, undefined).resolveFor(token());
		await new ZitadelClaimsService(settings, port()).resolveFor(token());
		await new ZitadelClaimsService().resolveFor(token());
		expect(resolveIdentity).not.toHaveBeenCalled();
	});

	it('signs in without hints when Ever Platform does not answer within 6 seconds', async () => {
		jest.useFakeTimers();
		try {
			const service = new ZitadelClaimsService(settings, port(() => new Promise(() => undefined)));
			const hints = service.resolveFor(token());
			await jest.advanceTimersByTimeAsync(RESOLVE_TIMEOUT_MS);
			await expect(hints).resolves.toEqual({
				personId: undefined,
				identityKind: undefined,
				enterpriseOrgId: undefined,
				filteredOrganizations: []
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it('signs in without hints when the port fails or knows nothing', async () => {
		const failing = new ZitadelClaimsService(settings, port(jest.fn().mockRejectedValue(new Error('down'))));
		expect((await failing.resolveFor(token())).filteredOrganizations).toEqual([]);
		const unknown = new ZitadelClaimsService(settings, port(jest.fn().mockResolvedValue(null)));
		expect(await unknown.resolveFor(token())).toEqual({
			personId: undefined,
			identityKind: undefined,
			enterpriseOrgId: undefined,
			filteredOrganizations: []
		});
	});
});

describe('Ever ID accounts of a person (deletion and export requests)', () => {
	interface Row {
		id: string;
		userId: string;
		tenantId: string;
		issuer: string;
		subject: string;
		linkMethod: string;
		tenant?: { name: string };
	}

	/** The `zitadel_account` repository, in memory, with the find options the listener uses. */
	function repository(rows: Row[]) {
		const value = (operator: unknown) => (operator as { value: unknown }).value;
		return {
			rows,
			find: jest.fn(async (options: { where: Record<string, unknown>; take: number }) => {
				const where = options.where ?? {};
				return rows
					.filter((row) => !where['id'] || row.id > String(value(where['id'])))
					.filter((row) => !where['tenantId'] || (value(where['tenantId']) as string[]).includes(row.tenantId))
					.sort((a, b) => (a.id < b.id ? -1 : 1))
					.slice(0, options.take);
			}),
			delete: jest.fn(async (where: { id: unknown }) => {
				const ids = value(where.id) as string[];
				for (const id of ids) rows.splice(rows.findIndex((row) => row.id === id), 1);
			})
		};
	}

	const sessions = () => ({ endSessionsOfUsers: jest.fn().mockResolvedValue(1) });
	const hash = (issuer: string, subject: string) => createHash('sha256').update(`${issuer}#${subject}`).digest('hex');

	function many(count: number): Row[] {
		return Array.from({ length: count }, (_, i) => ({
			id: String(i).padStart(6, '0'),
			userId: `user-${i}`,
			tenantId: i % 2 ? 't1' : 't2',
			issuer: 'https://auth.ever.co',
			subject: `subject-${i}`,
			linkMethod: 'explicit',
			tenant: { name: i % 2 ? 'Acme' : 'Zephyr' }
		}));
	}

	it('subjectHashOf is sha256(<issuer>#<subject>), as Ever Platform names an identity', () => {
		expect(subjectHashOf('https://auth.ever.co', '275396402232829475')).toBe(hash('https://auth.ever.co', '275396402232829475'));
	});

	it('finds the users of the named identities across pages, and reads nothing for a malformed hash', async () => {
		const repo = repository(many(1_201));
		const listener = new ZitadelPersonDataListener(repo as never, sessions() as never);
		expect(await listener.findUsers([hash('https://auth.ever.co', 'subject-1200'), hash('https://auth.ever.co', 'subject-3')])).toEqual([
			'user-3',
			'user-1200'
		]);
		expect(repo.find).toHaveBeenCalledTimes(3);
		repo.find.mockClear();
		expect(await listener.findUsers(['subject-3', 'ABC'])).toEqual([]);
		expect(repo.find).not.toHaveBeenCalled();
	});

	it('erase removes only the matching links and ends the Ever ID sessions of their users', async () => {
		const repo = repository(many(4));
		const ended = sessions();
		const listener = new ZitadelPersonDataListener(repo as never, ended as never);
		expect(await listener.erase([hash('https://auth.ever.co', 'subject-2')])).toEqual(['user-2']);
		expect(repo.rows.map((row) => row.id)).toEqual(['000000', '000001', '000003']);
		expect(repo.delete).toHaveBeenCalledWith({ id: In(['000002']) });
		expect(ended.endSessionsOfUsers).toHaveBeenCalledWith(['user-2']);
		// Nothing matching: nothing removed, no session ended.
		ended.endSessionsOfUsers.mockClear();
		expect(await listener.erase([hash('https://other.example', 'subject-1')])).toEqual([]);
		expect(ended.endSessionsOfUsers).not.toHaveBeenCalled();
	});

	it('links lists the links of the given tenants only, a page at a time, with the tenant name', async () => {
		const repo = repository(many(6));
		const listener = new ZitadelPersonDataListener(repo as never, sessions() as never);
		const first = await listener.links(['t1'], null, 2);
		expect(first.map((link) => [link.id, link.tenantName])).toEqual([
			['000001', 'Acme'],
			['000003', 'Acme']
		]);
		expect(repo.find).toHaveBeenLastCalledWith(
			expect.objectContaining({ where: { tenantId: In(['t1']) }, order: { id: 'ASC' }, take: 2 })
		);
		const next = await listener.links(['t1'], first[1].id, 2);
		expect(next.map((link) => link.id)).toEqual(['000005']);
		expect(repo.find).toHaveBeenLastCalledWith(
			expect.objectContaining({ where: { tenantId: In(['t1']), id: MoreThan('000003') } })
		);
		expect(await listener.links([], null, 2)).toEqual([]);
	});
});
