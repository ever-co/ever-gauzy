/**
 * Deferred Ever Works inbox items on the People tab (plan 04 §4): an item whose recipient is not paired waits as a
 * deferred event; the tab lists those per member, and pairing the member makes them due at once.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMManyToOne: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {}
	};
});

import 'reflect-metadata';
import { DEFERRED_INBOX_SAMPLE, deferredInboxOf, requeueDeferredInbox } from './ever-works-deferred-inbox';

const event = (id: string, itemId: string, recipientUserId: string | null, title = `Item ${itemId}`) => ({
	id,
	aggregateId: itemId,
	payload: JSON.stringify({
		type: 'inbox.item.created',
		occurredAt: '2026-10-17T00:00:00.000Z',
		aggregate: { type: 'inbox_item', id: itemId, version: 1 },
		data: { id: itemId, recipientUserId, title, kind: 'question' }
	})
});

describe('Deferred Ever Works inbox items (People tab)', () => {
	it('lists the waiting items per unpaired member: one entry per item, its newest event, most waiting first', () => {
		const rows = deferredInboxOf(
			[
				event('e5', 'i3', 'ew-bob', 'Bob, newest'),
				event('e4', 'i1', 'ew-ann', 'Ann, newer event'),
				event('e3', 'i2', 'ew-ann'),
				event('e2', 'i1', 'ew-ann', 'Ann, older event'),
				event('e1', 'i9', 'ew-paired'),
				{ id: 'e0', aggregateId: 'ix', payload: 'not json' },
				event('e-', 'iy', null)
			],
			new Set(['ew-paired'])
		);
		expect(rows).toEqual([
			{
				ewUserId: 'ew-ann',
				count: 2,
				items: [
					{ ewItemId: 'i1', title: '', kind: 'question', occurredAt: '2026-10-17T00:00:00.000Z' },
					{ ewItemId: 'i2', title: '', kind: 'question', occurredAt: '2026-10-17T00:00:00.000Z' }
				]
			},
			{
				ewUserId: 'ew-bob',
				count: 1,
				items: [{ ewItemId: 'i3', title: '', kind: 'question', occurredAt: '2026-10-17T00:00:00.000Z' }]
			}
		]);
	});

	it('never lists the title of a member’s private inbox item to the admin reading the tab (review F103)', () => {
		const rows = deferredInboxOf([event('e1', 'i1', 'ew-ann', 'Your salary review is ready')], new Set());
		expect(JSON.stringify(rows)).not.toContain('salary');
		expect(rows[0].items).toEqual([
			{ ewItemId: 'i1', title: '', kind: 'question', occurredAt: '2026-10-17T00:00:00.000Z' }
		]);
	});

	it('counts every waiting item but lists only the newest few', () => {
		const events = Array.from({ length: DEFERRED_INBOX_SAMPLE + 3 }, (_, n) => event(`e${n}`, `i${n}`, 'ew-ann'));
		const [row] = deferredInboxOf(events, new Set());
		expect(row.count).toBe(DEFERRED_INBOX_SAMPLE + 3);
		expect(row.items).toHaveLength(DEFERRED_INBOX_SAMPLE);
		expect(row.items[0].ewItemId).toBe('i0');
	});

	it('pairing a member makes only their still-deferred events due now', async () => {
		const update = jest.fn(async () => ({ affected: 2, raw: [], generatedMaps: [] }));
		const now = new Date('2026-10-17T01:00:00.000Z');
		const events = [event('e1', 'i1', 'ew-ann'), event('e2', 'i2', 'ew-bob'), event('e3', 'i3', 'ew-ann')];
		expect(await requeueDeferredInbox({ update } as never, events, new Set(['ew-ann']), now)).toBe(2);
		const [where, values] = update.mock.calls[0] as unknown as [
			{ id: { value: string[] }; status: string },
			unknown
		];
		expect(where.id.value).toEqual(['e1', 'e3']);
		expect(where.status).toBe('deferred');
		expect(values).toEqual({ availableAt: now });
		expect(await requeueDeferredInbox({ update } as never, events, new Set(['ew-carol']), now)).toBe(0);
		expect(update).toHaveBeenCalledTimes(1);
	});
});
