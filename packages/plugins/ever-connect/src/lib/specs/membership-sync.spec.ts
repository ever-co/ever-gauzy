import {
	EVER_ROLE_TO_GAUZY_ROLE,
	isAfter,
	isMembershipSyncEnabled,
	membershipChangeOf,
	parseMembershipData,
	sameIssuer
} from '../membership/membership-sync.config';
import { MembershipSyncHandler, membershipSyncProviders } from '../membership/membership-sync.handler';

/**
 * The membership sync's switch, event types, role mapping and event shape, without a database (the changes
 * themselves: `membership-sync.db.spec.ts`).
 */
describe('Ever Platform membership sync: switch, mapping, shape', () => {
	const ON = { EVER_CONNECT_ENABLED: 'true', EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'true', ZITADEL_ENABLED: 'true' };

	describe('the switch (off by default)', () => {
		it('is on only with the connection, Ever ID sign-in and the exact value true', () => {
			expect(isMembershipSyncEnabled(ON)).toBe(true);
			for (const env of [
				{},
				{ EVER_CONNECT_ENABLED: 'true' },
				{ EVER_CONNECT_ENABLED: 'true', ZITADEL_ENABLED: 'true' },
				{ ...ON, EVER_CONNECT_ENABLED: 'false' },
				{ ...ON, EVER_CONNECT_ENABLED: undefined },
				{ ...ON, ZITADEL_ENABLED: undefined },
				{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: '' },
				{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'false' },
				{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'TRUE' },
				{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: '1' }
			]) {
				expect(isMembershipSyncEnabled(env)).toBe(false);
			}
		});

		it('warns once for a value it does not take, without repeating it, and never while the connection is off', () => {
			const warn = jest.fn();
			isMembershipSyncEnabled({ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'yes-please' }, warn);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).not.toContain('yes-please');
			warn.mockClear();
			isMembershipSyncEnabled({ ...ON, ZITADEL_ENABLED: undefined }, warn);
			expect(warn).toHaveBeenCalledTimes(1);
			warn.mockClear();
			isMembershipSyncEnabled({ EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'yes-please' }, warn);
			isMembershipSyncEnabled({}, warn);
			expect(warn).not.toHaveBeenCalled();
		});

		it('off: no provider is registered', () => {
			expect(membershipSyncProviders({})).toEqual([]);
			expect(membershipSyncProviders({ EVER_CONNECT_ENABLED: 'true' })).toEqual([]);
			expect(membershipSyncProviders({ ...ON, ZITADEL_ENABLED: undefined })).toEqual([]);
			expect(membershipSyncProviders({ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'false' })).toEqual([]);
			expect(membershipSyncProviders(ON)).toEqual([MembershipSyncHandler]);
		});

		it('off: an event reaching the handler anyway reads and writes nothing', async () => {
			const store = { linkById: jest.fn(), liveLinks: jest.fn() };
			const audit = { record: jest.fn() };
			const dataSource = { options: { type: 'better-sqlite3' }, query: jest.fn(), createQueryRunner: jest.fn() };
			const handler = new MembershipSyncHandler(dataSource as never, store as never, audit as never, {});
			const outcome = await handler.apply({
				id: '01JD0000000000000000000001',
				type: 'ever.registry.membership.created',
				version: 1,
				occurred_at: '2026-11-02T10:00:00Z',
				data: {
					tenant_link_id: '01JC5M2R4T6V8X0Z2B4D6F8H0K',
					identity_issuer: 'https://id.example.test',
					identity_subject: 'sub-bob',
					role: 'admin'
				}
			} as never);
			expect(outcome).toBe('switched_off');
			expect(store.linkById).not.toHaveBeenCalled();
			expect(store.liveLinks).not.toHaveBeenCalled();
			expect(audit.record).not.toHaveBeenCalled();
			expect(dataSource.query).not.toHaveBeenCalled();
			expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
		});
	});

	it('the three membership changes, and nothing else', () => {
		expect(membershipChangeOf('ever.registry.membership.created')).toBe('created');
		expect(membershipChangeOf('ever.registry.membership.role_changed')).toBe('role_changed');
		expect(membershipChangeOf('ever.registry.membership.removed')).toBe('removed');
		for (const type of [
			'ever.registry.membership.listing_changed',
			'ever.registry.person.deletion_requested',
			'toString',
			'__proto__',
			''
		]) {
			expect(membershipChangeOf(type)).toBeNull();
		}
	});

	it('the role mapping: owner and admin are ADMIN, member is no role, SUPER_ADMIN is never granted', () => {
		expect(EVER_ROLE_TO_GAUZY_ROLE).toEqual({ owner: 'ADMIN', admin: 'ADMIN', member: null });
		expect(Object.values(EVER_ROLE_TO_GAUZY_ROLE)).not.toContain('SUPER_ADMIN');
		expect(Object.isFrozen(EVER_ROLE_TO_GAUZY_ROLE)).toBe(true);
	});

	describe("the installation's shape of a membership event", () => {
		const valid = {
			tenant_link_id: '01JC5M2R4T6V8X0Z2B4D6F8H0K',
			identity_issuer: 'https://auth.ever.co',
			identity_subject: '275396402232829475',
			product_user_ref: '3f1c1d4a-7b2e-4f0a-9d3c-2a6b1e5f8c01',
			role: 'admin'
		};

		it('is read', () => {
			expect(parseMembershipData(valid)).toEqual({
				linkId: valid.tenant_link_id,
				issuer: valid.identity_issuer,
				subject: valid.identity_subject,
				userRef: valid.product_user_ref,
				role: 'admin'
			});
			// Without a person link on Ever Platform, the event names no Gauzy user.
			expect(parseMembershipData({ ...valid, product_user_ref: undefined })?.userRef).toBeNull();
		});

		it.each([
			[
				'the organization shape',
				{ org_id: '01JBX1A2B3C4D5E6F7G8H9J0K1', person_id: '01JBX1A2B3C4D5E6F7G8H9J0P1', role: 'admin' }
			],
			['no link', { ...valid, tenant_link_id: undefined }],
			['a link that is not a ULID', { ...valid, tenant_link_id: 'link-1' }],
			['an issuer that is not https', { ...valid, identity_issuer: 'http://auth.ever.co' }],
			['an issuer that is not a URL', { ...valid, identity_issuer: 'auth.ever.co' }],
			['a subject with a space', { ...valid, identity_subject: 'a b' }],
			['a subject too long', { ...valid, identity_subject: 'x'.repeat(65) }],
			['a user reference that is not an id', { ...valid, product_user_ref: 'bob@example.com' }],
			['no role', { ...valid, role: undefined }],
			['an array', [valid]],
			['nothing', null]
		])('%s is not one', (_, data) => {
			expect(parseMembershipData(data)).toBeNull();
		});
	});

	it('an issuer with or without trailing slashes is the same issuer', () => {
		expect(sameIssuer('https://auth.ever.co/')).toBe(sameIssuer('https://auth.ever.co'));
		expect(sameIssuer('https://auth.ever.co//')).toBe('https://auth.ever.co');
	});

	it('the order of changes is total: an untimed event never comes after a timed one, nor a timed one before it', () => {
		const x = { eventId: '01JD0000000000000000000001', occurredAt: Date.parse('2026-11-03T00:00:00Z') };
		const b = { eventId: '01JD0000000000000000000005', occurredAt: null };
		const c = { eventId: '01JD0000000000000000000009', occurredAt: Date.parse('2026-11-02T00:00:00Z') };
		expect(isAfter(b, x)).toBe(false);
		expect(isAfter(x, b)).toBe(true);
		expect(isAfter(c, b)).toBe(true);
		expect(isAfter(x, c)).toBe(true);
		expect(isAfter(c, x)).toBe(false);
	});

	it('at the same time, ids compare in one case (ULIDs are case-insensitive)', () => {
		const at = Date.parse('2026-11-02T00:00:00Z');
		expect(
			isAfter(
				{ eventId: '01JD000000000000000000000B', occurredAt: at },
				{ eventId: '01jd000000000000000000000a', occurredAt: at }
			)
		).toBe(true);
		expect(
			isAfter(
				{ eventId: '01jd000000000000000000000a', occurredAt: at },
				{ eventId: '01JD000000000000000000000B', occurredAt: at }
			)
		).toBe(false);
	});

	it('the order of changes: by time, then by id', () => {
		const at = (iso: string) => Date.parse(iso);
		expect(
			isAfter(
				{ eventId: '01JD0000000000000000000001', occurredAt: at('2026-11-03T00:00:00Z') },
				{ eventId: '01JD0000000000000000000009', occurredAt: at('2026-11-02T00:00:00Z') }
			)
		).toBe(true);
		expect(
			isAfter(
				{ eventId: '01JD0000000000000000000009', occurredAt: at('2026-11-01T00:00:00Z') },
				{ eventId: '01JD0000000000000000000001', occurredAt: at('2026-11-02T00:00:00Z') }
			)
		).toBe(false);
		// Same time, or no time: the id decides.
		expect(
			isAfter(
				{ eventId: '01JD0000000000000000000002', occurredAt: 5 },
				{ eventId: '01JD0000000000000000000001', occurredAt: 5 }
			)
		).toBe(true);
		expect(
			isAfter(
				{ eventId: '01jd0000000000000000000002', occurredAt: null },
				{ eventId: '01JD0000000000000000000003', occurredAt: 5 }
			)
		).toBe(false);
	});
});
