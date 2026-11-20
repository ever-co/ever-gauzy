import {
	ensureLinkMembershipsOperation,
	LINK_MEMBERSHIPS_OPERATION,
	LinkMembershipsAnswerError,
	ListedMembers,
	parseCurrentMember,
	positionAfter,
	readLinkMembershipsPage
} from '../membership/membership-resync';
import { isAfter } from '../membership/membership-sync.config';
import { OperationSpec } from '../sdk';

/**
 * The membership resync's reading side, without a database (the resync itself: `membership-resync.db.spec.ts`): the
 * call (`GET /v1/instances/me/tenant-links/{link}/memberships` through the SDK client), the page and member shapes,
 * and the position a resync's change takes.
 */
describe('Ever Platform membership resync: call, shapes, positions', () => {
	const LINK = '01JC5M2R4T6V8X0Z2B4D6F8H0K';
	const member = (values: Record<string, unknown> = {}) => ({
		identity_issuer: 'https://auth.example.test',
		identity_subject: 'sub-bob',
		role: 'admin',
		...values
	});

	it('adds the operation to the SDK table once, and keeps one the SDK ships', () => {
		const table: Record<string, OperationSpec> = {};
		ensureLinkMembershipsOperation(table);
		expect(table[LINK_MEMBERSHIPS_OPERATION]).toMatchObject({
			method: 'GET',
			path: '/v1/instances/me/tenant-links/{link}/memberships',
			pathParams: ['link'],
			query: ['cursor', 'limit'],
			auth: 'instance',
			success: [200]
		});
		const own = { id: LINK_MEMBERSHIPS_OPERATION } as OperationSpec;
		const shipped: Record<string, OperationSpec> = { [LINK_MEMBERSHIPS_OPERATION]: own };
		ensureLinkMembershipsOperation(shipped);
		expect(shipped[LINK_MEMBERSHIPS_OPERATION]).toBe(own);
	});

	it('reads a page through the client; an answer that is not a page is an error', async () => {
		const call = jest
			.fn()
			.mockResolvedValueOnce({ tenant_link_id: LINK, items: [member()], next_cursor: 'c-2' })
			.mockResolvedValueOnce({ tenant_link_id: LINK, items: [], next_cursor: null })
			.mockResolvedValueOnce({ next_cursor: null })
			.mockResolvedValueOnce({ items: [], next_cursor: 7 });
		const client = { call } as never;

		await expect(readLinkMembershipsPage(client, LINK, null)).resolves.toEqual({
			items: [member()],
			nextCursor: 'c-2'
		});
		await expect(readLinkMembershipsPage(client, LINK, 'c-2')).resolves.toEqual({ items: [], nextCursor: null });
		expect(call.mock.calls).toEqual([
			[LINK_MEMBERSHIPS_OPERATION, { path: { link: LINK }, query: { limit: 100, cursor: undefined } }],
			[LINK_MEMBERSHIPS_OPERATION, { path: { link: LINK }, query: { limit: 100, cursor: 'c-2' } }]
		]);
		await expect(readLinkMembershipsPage(client, LINK, null)).rejects.toBeInstanceOf(LinkMembershipsAnswerError);
		await expect(readLinkMembershipsPage(client, LINK, null)).rejects.toBeInstanceOf(LinkMembershipsAnswerError);
	});

	it('a member is checked as an event is; never an e-mail or a person id', () => {
		expect(parseCurrentMember(member({ product_user_ref: 'user-1' }))).toEqual({
			issuer: 'https://auth.example.test',
			subject: 'sub-bob',
			userRef: 'user-1',
			role: 'admin'
		});
		expect(parseCurrentMember(member({ product_user_ref: null }))?.userRef).toBeNull();
		for (const bad of [
			null,
			[],
			member({ identity_issuer: 'http://auth.example.test' }),
			member({ identity_subject: 'a b' }),
			member({ product_user_ref: 'no spaces allowed' }),
			member({ role: 3 })
		]) {
			expect(parseCurrentMember(bad)).toBeNull();
		}
	});

	it('the listed members: users, Ever IDs (an issuer with or without its slash) and issuers', () => {
		const listed = new ListedMembers();
		listed.add(parseCurrentMember(member({ identity_issuer: 'https://auth.example.test/' }))!, 'u-1');
		listed.add(parseCurrentMember(member({ identity_subject: 'sub-carol', product_user_ref: 'u-2' }))!, null);
		expect([...listed.userIds]).toEqual(['u-1', 'u-2']);
		expect([...listed.issuers]).toEqual(['https://auth.example.test']);
		expect([...listed.identities]).toEqual([
			'https://auth.example.test#sub-bob',
			'https://auth.example.test#sub-carol'
		]);
	});

	it('a resync takes its place right after the last change, and before the next event', () => {
		const last = { eventId: '01JD0000000000000000000009', occurredAt: Date.parse('2026-11-02T10:00:00Z') };
		const next = positionAfter(last);
		expect(next).toEqual({ eventId: '01JD000000000000000000000A', occurredAt: last.occurredAt });
		expect(isAfter(next, last)).toBe(true);
		expect(isAfter({ eventId: '01JD0000000000000000000010', occurredAt: last.occurredAt + 1 }, next)).toBe(true);
		expect(positionAfter({ eventId: '01JD00000000000000000000ZZ', occurredAt: 5 }).eventId).toBe(
			'01JD0000000000000000000100'
		);

		const first = positionAfter(null);
		expect(first.occurredAt).toBe(0);
		expect(first.eventId).toMatch(/^0000000000[0-9A-HJKMNP-TV-Z]{16}$/);
		expect(isAfter({ eventId: '01JD0000000000000000000001', occurredAt: Date.parse('2026-01-01') }, first)).toBe(
			true
		);
		// Two people's first resyncs never share an id (an id may become a grant's).
		expect(positionAfter(null).eventId).not.toBe(first.eventId);
	});
});
