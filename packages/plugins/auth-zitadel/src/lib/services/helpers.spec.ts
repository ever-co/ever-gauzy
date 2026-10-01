import type { User } from '@gauzy/core';
import { ZitadelClaimsService } from './zitadel-claims.service';
import { safeRedirect } from './zitadel-flow.service';
import { maskSubject } from './zitadel-link.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { withoutEmail } from './zitadel-subscription-gate.service';
import { unverifiedIssuer } from './zitadel-token-signin.service';
import { ZitadelWorkspaceService } from './zitadel-workspace.service';
import { InMemoryCache } from '../fixtures/in-memory-accounts';

describe('Ever ID plugin helpers', () => {
	it('accepts only web app paths as the post-sign-in redirect', () => {
		const client = 'https://app.example.test';
		expect(safeRedirect('/pages/dashboard', client)).toBe('/pages/dashboard');
		expect(safeRedirect('https://app.example.test/pages/x?y=1', client)).toBe('/pages/x?y=1');
		expect(safeRedirect('https://evil.example.test/pages', client)).toBeUndefined();
		expect(safeRedirect('//evil.example.test', client)).toBeUndefined();
		expect(safeRedirect('/\\evil.example.test', client)).toBeUndefined();
		expect(safeRedirect('javascript:alert(1)', client)).toBeUndefined();
		expect(safeRedirect('/' + 'a'.repeat(600), client)).toBeUndefined();
	});

	it('drops the e-mail address from a checkout URL', () => {
		expect(withoutEmail('https://ever.example.test/checkout?email=a%40b.test&plan=starter')).toBe(
			'https://ever.example.test/checkout?plan=starter'
		);
		expect(withoutEmail('https://ever.example.test/checkout?plan=gauzy?email=a%40b.test')).toBe(
			'https://ever.example.test/checkout?plan=gauzy'
		);
		expect(withoutEmail('https://ever.example.test/checkout?ref=a@b.test')).toBe('https://ever.example.test/checkout');
		expect(withoutEmail('not a url')).toBe('');
		expect(withoutEmail(undefined)).toBe('');
	});

	it('reads the issuer of a token without trusting it', () => {
		const payload = Buffer.from(JSON.stringify({ iss: 'https://idp.example.test' })).toString('base64url');
		expect(unverifiedIssuer(`e30.${payload}.sig`)).toBe('https://idp.example.test');
		expect(unverifiedIssuer('opaque-token')).toBeUndefined();
		expect(unverifiedIssuer('a.!!!.c')).toBeUndefined();
	});

	it('masks subjects', () => {
		expect(maskSubject('281734981273498712')).toBe('••••8712');
		expect(maskSubject('abc')).toBe('••••');
	});

	it('reads organization hints strictly: an entry without an "id" filters nothing', () => {
		const hints = new ZitadelClaimsService().resolve({
			'urn:ever:orgs_filtered': [{ id: 'org-1', reason: 'sso_required' }, { org_id: 'org-2' }, 'org-3', null],
			'urn:ever:identity_kind': 'personal',
			'urn:ever:person_id': 'person-1'
		});
		expect(hints.filteredOrganizations).toEqual([{ id: 'org-1', handle: undefined, reason: 'sso_required' }]);
		expect(hints.identityKind).toBe('personal');
		expect(hints.personId).toBe('person-1');
		expect(new ZitadelClaimsService().resolve({}).filteredOrganizations).toEqual([]);
	});

	describe('one-time records', () => {
		it('hands a key out once, also to concurrent callers', async () => {
			const store = new ZitadelStoreService(new InMemoryCache(), null);
			const key = store.newKey();
			await store.put('handoff', key, { value: 1 }, 60);
			const [first, second] = await Promise.all([store.take('handoff', key), store.take('handoff', key)]);
			expect([first, second].filter(Boolean)).toEqual([{ value: 1 }]);
			expect(await store.take('handoff', key)).toBeNull();
		});

		it('uses Redis GETDEL when Redis is configured', async () => {
			const data = new Map<string, string>();
			const redis = {
				get: async (k: string) => data.get(k) ?? null,
				set: async (k: string, v: string) => void data.set(k, v),
				getDel: jest.fn(async (k: string) => {
					const v = data.get(k) ?? null;
					data.delete(k);
					return v;
				}),
				del: async (k: string) => void data.delete(k)
			};
			const store = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = store.newKey();
			await store.put('handoff', key, { value: 2 }, 60);
			expect(await store.take('handoff', key)).toEqual({ value: 2 });
			expect(await store.take('handoff', key)).toBeNull();
			expect(redis.getDel).toHaveBeenCalledTimes(2);
		});

		it('never looks up a malformed key', async () => {
			const cache = new InMemoryCache();
			const spy = jest.spyOn(cache, 'get');
			const store = new ZitadelStoreService(cache, null);
			expect(await store.take('handoff', 'short')).toBeNull();
			expect(await store.get('handoff', '../../etc/passwd'.padEnd(20, 'x'))).toBeNull();
			expect(spy).not.toHaveBeenCalled();
		});

		it('derives the same pending sign-up key for the same identity only', () => {
			const store = new ZitadelStoreService(new InMemoryCache(), null);
			expect(store.identityKey('https://i.test', 'a')).toBe(store.identityKey('https://i.test', 'a'));
			expect(store.identityKey('https://i.test', 'a')).not.toBe(store.identityKey('https://i.test', 'b'));
		});
	});

	it('builds workspace entries as plain data that survive the JSON round trip of the hand-off store', () => {
		// At runtime the ORM gives entities a `toJSON` that drops fields; a plain object has none.
		const service = new ZitadelWorkspaceService(null as never, null as never);
		const user = {
			id: 'user-1',
			email: 'person@example.test',
			name: 'Test Person',
			tenantId: 'tenant-1',
			tenant: { id: 'tenant-1', name: 'Acme', logo: '' }
		} as unknown as User;
		const { workspaces, confirmed_email } = service.workspaces([user]);
		expect(Object.getPrototypeOf(workspaces[0].user)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(workspaces[0].user.tenant)).toBe(Object.prototype);
		const stored = JSON.parse(JSON.stringify(workspaces[0]));
		expect(stored.user).toEqual(
			expect.objectContaining({ id: 'user-1', email: 'person@example.test', tenant: { id: 'tenant-1', name: 'Acme', logo: '' } })
		);
		expect(confirmed_email).toBe('person@example.test');
	});
});
